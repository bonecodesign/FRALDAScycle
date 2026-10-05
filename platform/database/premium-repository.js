import {institutionPublicationAllowed} from "./institution-publication.js";
import { requireNewOperations,newOperationsAllowed } from './moderation-repository.js';
import { premiumEntitlement, freeListingPlan, FREE_LISTING_LIMIT } from '../packages/contracts/premium-rules.js';
const fail = (code, message) => Object.assign(new Error(message), { code, status: 409 });

export async function lockPremiumAccount(client, userId) {
  const user = await client.query('SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE', [userId]);
  if (!user.rows[0]) throw fail('account_unavailable', 'Conta indisponível.');
  const result = await client.query(`SELECT clock_timestamp() AS checked_at,
    (SELECT row_to_json(p) FROM premium_subscriptions p WHERE p.user_id=$1) AS subscription` , [userId]);
  const { checked_at: now, subscription: row } = result.rows[0];
  const subscription = row ? {
    paidPeriodStart: new Date(row.paid_period_start).toISOString(), paidPeriodEnd: new Date(row.paid_period_end).toISOString(),
    renewalEnabled: row.renewal_enabled, renewalFailedAt: row.renewal_failed_at ? new Date(row.renewal_failed_at).toISOString() : null,
  } : null;
  return { subscription, entitlement: premiumEntitlement(subscription, new Date(now).toISOString()) };
}

async function ownedListings(client, userId) {
  const result = await client.query(`SELECT l.id,l.seller_id,l.title,l.status,l.published_at,
    EXISTS(SELECT 1 FROM transactions t WHERE t.listing_id=l.id AND t.status NOT IN ('cancelled','refunded','completed')) AS ongoing
    FROM listings l WHERE l.seller_id=$1 ORDER BY l.published_at DESC NULLS LAST,l.id FOR UPDATE OF l`, [userId]);
  return result.rows;
}
const asRules = rows => rows.map(row => ({ id: row.id, sellerId: row.seller_id, status: row.status,
  publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null, ongoingTransaction: row.ongoing }));

export async function adjustFreeListings(client, userId, context) {
  if (context.entitlement.benefitsActive) return { pausedIds: [], keptIds: [], preservedIds: [] };
  const rows = await ownedListings(client, userId);
  const choice = (await client.query('SELECT * FROM premium_listing_choices WHERE user_id=$1', [userId])).rows[0];
  const available = new Set(rows.filter(row => row.status === 'published' && !row.ongoing).map(row => row.id));
  const currentChoice = choice && !choice.applied_at && context.entitlement.paidThrough === new Date(choice.paid_period_end).toISOString();
  const selectedIds = currentChoice
    ? choice.selected_ids.filter(id => available.has(id)) : null;
  const plan = freeListingPlan({ userId, listings: asRules(rows), selectedIds });
  if (plan.pauseIds.length) {
    await client.query("UPDATE listings SET status='paused',updated_at=now() WHERE id=ANY($1::uuid[]) AND seller_id=$2 AND status='published'", [plan.pauseIds, userId]);
    await client.query(`INSERT INTO premium_listing_adjustments(user_id,kept_ids,paused_ids) VALUES($1,$2::uuid[],$3::uuid[])`, [userId, plan.keepIds, plan.pauseIds]);
    await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
      VALUES($1::uuid,'premium.listings.adjusted','user',$1::text,$2::jsonb)`, [userId, JSON.stringify({ keptIds: plan.keepIds, pausedIds: plan.pauseIds })]);
  }
  if (currentChoice) await client.query('UPDATE premium_listing_choices SET applied_at=now() WHERE user_id=$1', [userId]);
  return { pausedIds: plan.pauseIds, keptIds: plan.keepIds, preservedIds: plan.preservedIds };
}

export async function freePublicationAvailable(client, userId, context) {
  if (!await newOperationsAllowed(client,userId)) return false;
  if (context.entitlement.benefitsActive) return true;
  const result = await client.query("SELECT count(*)::integer AS count FROM listings WHERE seller_id=$1 AND status='published'", [userId]);
  return result.rows[0].count < FREE_LISTING_LIMIT;
}

export function createPremiumRepository(database) {
  async function summary(client, userId, context) {
    const listings = await ownedListings(client, userId);
    const choice = (await client.query('SELECT * FROM premium_listing_choices WHERE user_id=$1', [userId])).rows[0];
    const currentChoice = choice && context.entitlement.paidThrough === new Date(choice.paid_period_end).toISOString();
    return { ...context.entitlement, monthlyCents: 1290, freeListingLimit: FREE_LISTING_LIMIT,
      choice: currentChoice ? { version: choice.version, selectedIds: choice.selected_ids } : { version: 0, selectedIds: null },
      listings: listings.map(row => ({ id: row.id, title: row.title, status: row.status, ongoingTransaction: row.ongoing })) };
  }
  return Object.freeze({
    status(userId) { return database.transaction(async client => summary(client, userId, await lockPremiumAccount(client, userId))); },
    cancelRenewal(userId) {
      return database.transaction(async client => {
        const context = await lockPremiumAccount(client, userId);
        if (!context.subscription) throw fail('premium_not_subscribed', 'Não há assinatura para cancelar.');
        const reused = !context.subscription.renewalEnabled;
        if (!reused) {
          await client.query('UPDATE premium_subscriptions SET renewal_enabled=false,renewal_cancelled_at=now(),updated_at=now() WHERE user_id=$1', [userId]);
          await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
            VALUES($1::uuid,'premium.renewal.cancelled','user',$1::text,'{}'::jsonb)`, [userId]);
          context.entitlement.renewalEnabled = false;
        }
        return { reused, premium: await summary(client, userId, context) };
      });
    },
    saveChoice(userId, { selectedIds, expectedVersion }) {
      return database.transaction(async client => {
        const context = await lockPremiumAccount(client, userId);
        if (!context.entitlement.benefitsActive) throw fail('premium_choice_period_ended', 'O período de escolha terminou.');
        const rows = await ownedListings(client, userId);
        try { freeListingPlan({ userId, listings: asRules(rows), selectedIds }); }
        catch { throw fail('premium_invalid_choice', 'Escolha até três anúncios próprios, publicados e sem operação em andamento.'); }
        const old = (await client.query('SELECT * FROM premium_listing_choices WHERE user_id=$1', [userId])).rows[0];
        const current = old && context.entitlement.paidThrough === new Date(old.paid_period_end).toISOString();
        const equal = current && JSON.stringify([...old.selected_ids].sort()) === JSON.stringify([...selectedIds].sort());
        if (equal) return { reused: true, premium: await summary(client, userId, context) };
        if ((current ? old.version : 0) !== expectedVersion) throw fail('premium_choice_conflict', 'A escolha mudou. Carregue novamente.');
        await client.query(`INSERT INTO premium_listing_choices(user_id,paid_period_end,selected_ids,version)
          VALUES($1,$2,$3::uuid[],1) ON CONFLICT(user_id) DO UPDATE SET paid_period_end=$2,selected_ids=$3::uuid[],
          version=CASE WHEN premium_listing_choices.paid_period_end=$2 THEN premium_listing_choices.version+1 ELSE 1 END,applied_at=NULL,updated_at=now()`,
        [userId, context.entitlement.paidThrough, selectedIds]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1::uuid,'premium.listings.chosen','user',$1::text,$2::jsonb)`, [userId, JSON.stringify({ selectedIds })]);
        return { reused: false, premium: await summary(client, userId, context) };
      });
    },
    regularize(userId) { return database.transaction(async client => adjustFreeListings(client, userId, await lockPremiumAccount(client, userId))); },
    changeListingStatus(userId, { listingId, status, expectedStatus }) {
      return database.transaction(async client => {
        const context = await lockPremiumAccount(client, userId);
        if(status==='published'){
          const reference=(await client.query('SELECT kind,institution_id,package_condition FROM listings WHERE id=$1 AND seller_id=$2',[listingId,userId])).rows[0];
          if(!reference)throw Object.assign(new Error('Anúncio não encontrado.'),{code:'listing_not_found',status:404});
          if(!await institutionPublicationAllowed(client,reference))throw fail('donation_institution_unavailable','A instituição não permite novas doações.');
        }
        const rows = await ownedListings(client, userId);
        const listing = rows.find(row => row.id === listingId);
        if (!listing) throw Object.assign(new Error('Anúncio não encontrado.'), { code: 'listing_not_found', status: 404 });
        if (listing.ongoing || !['published','paused'].includes(listing.status)) throw fail('listing_operation_pending', 'Anúncio ligado a operação ou em revisão não pode ser alterado aqui.');
        if (listing.status === status) return { reused: true, listing: { id: listingId, status } };
        if (listing.status !== expectedStatus) throw fail('listing_status_conflict', 'O anúncio mudou. Carregue novamente.');
        if (status === 'published') await requireNewOperations(client,userId);
        if (status === 'published' && !await freePublicationAvailable(client, userId, context)) throw fail('free_listing_limit', 'O plano gratuito permite até três anúncios publicados.');
        await client.query('UPDATE listings SET status=$2::listing_status,updated_at=now() WHERE id=$1', [listingId, status]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'listing.publication.changed','listing',$2,$3::jsonb)`, [userId, listingId, JSON.stringify({ status })]);
        return { reused: false, listing: { id: listingId, status } };
      });
    },
    async regularizeExpired() {
      const users = await database.query(`SELECT user_id FROM premium_subscriptions WHERE paid_period_end<=now()
        UNION SELECT seller_id FROM listings WHERE status='published' GROUP BY seller_id HAVING count(*)>3`);
      const results = [];
      for (const { user_id: userId } of users.rows) results.push(await this.regularize(userId));
      return { accountsChecked: results.length, pausedCount: results.reduce((n, result) => n + result.pausedIds.length, 0), billingAllowed: false };
    },
  });
}
