import { effectivePriceCeiling, productEconomyBasisPoints } from '../packages/contracts/monthly-pricing-rules.js';

const protectedTransactionStatuses = ['reserved','payment_pending','paid','in_delivery','donation_confirmed','disputed'];

export function createMonthlyPricingRepository(database) {
  return Object.freeze({
    async saveReference({ referenceKey, validFrom, validUntil, prmCents, lowestRetailCents, collectedAt, metadata = {} }) {
      const ceilingCents = effectivePriceCeiling({ prmCents, lowestRetailCents });
      const result = await database.query(`INSERT INTO market_price_reference_cycles
        (reference_key,valid_from,valid_until,prm_cents,lowest_retail_cents,effective_ceiling_cents,collected_at,metadata)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
        ON CONFLICT(reference_key,valid_from) DO UPDATE SET
          valid_until=EXCLUDED.valid_until,prm_cents=EXCLUDED.prm_cents,
          lowest_retail_cents=EXCLUDED.lowest_retail_cents,effective_ceiling_cents=EXCLUDED.effective_ceiling_cents,
          collected_at=EXCLUDED.collected_at,metadata=EXCLUDED.metadata,status='active'
        RETURNING *`, [referenceKey,validFrom,validUntil,prmCents,lowestRetailCents,ceilingCents,collectedAt,JSON.stringify(metadata)]);
      return result.rows[0];
    },

    async expireListings() {
      return database.transaction(async client => {
        const expired=(await client.query(`UPDATE listings l SET status='removed',pause_reason=NULL,updated_at=now()
          WHERE l.status IN('published','paused') AND l.expires_at IS NOT NULL AND l.expires_at<=now()
            AND NOT EXISTS(SELECT 1 FROM transactions t WHERE t.listing_id=l.id
              AND t.status=ANY($1::transaction_status[]))
          RETURNING l.id,l.seller_id,l.title,l.expires_at`,[protectedTransactionStatuses])).rows;
        for(const listing of expired){
          const user=(await client.query('SELECT email FROM users WHERE id=$1',[listing.seller_id])).rows[0];
          if(user?.email) await client.query(`INSERT INTO notification_outbox(kind,recipient,payload,recipient_user_id)
            VALUES('general_reminder'::auth_token_kind,$1,$2::jsonb,$3)`,
            [user.email,JSON.stringify({channel:'email',event:'listing_expired',listingId:listing.id,title:listing.title,expiredAt:listing.expires_at}),listing.seller_id]);
          await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
            VALUES(NULL,'listing.expired','listing',$1,$2::jsonb)`,[listing.id,JSON.stringify({expiredAt:listing.expires_at})]);
        }
        return { expired:expired.length, listingIds:expired.map(item=>item.id) };
      });
    },

    async adjustPausedListingPrice({ sellerId, listingId, priceCents }) {
      return database.transaction(async client => {
        if (!Number.isInteger(priceCents) || priceCents < 0) throw Object.assign(new Error('Preço inválido.'), { code:'listing_price_invalid', status:422 });
        const listing=(await client.query(`SELECT id,seller_id,price_cents,status,pause_reason,published_at,expires_at,price_reference_key
          FROM listings WHERE id=$1 AND seller_id=$2 FOR UPDATE`,[listingId,sellerId])).rows[0];
        if(!listing) throw Object.assign(new Error('Anúncio não encontrado.'),{code:'listing_not_found',status:404});
        if(listing.status!=='paused' || listing.pause_reason!=='price_adjustment_required')
          throw Object.assign(new Error('Este anúncio não aguarda ajuste obrigatório de preço.'),{code:'listing_price_adjustment_unavailable',status:409});
        if(!listing.expires_at || new Date(listing.expires_at).getTime()<=Date.now())
          throw Object.assign(new Error('O anúncio expirou e precisa ser republicado em um novo ciclo.'),{code:'listing_expired',status:409});
        const active=(await client.query(`SELECT 1 FROM transactions WHERE listing_id=$1
          AND status=ANY($2::transaction_status[]) LIMIT 1`,[listingId,protectedTransactionStatuses])).rowCount>0;
        if(active) throw Object.assign(new Error('O anúncio possui uma operação protegida em andamento.'),{code:'listing_operation_active',status:409});
        const reference=(await client.query(`SELECT * FROM market_price_reference_cycles
          WHERE reference_key=$1 AND status IN('active','extended') AND valid_from<=CURRENT_DATE AND valid_until>CURRENT_DATE
          ORDER BY valid_from DESC LIMIT 1 FOR SHARE`,[listing.price_reference_key])).rows[0];
        if(!reference) throw Object.assign(new Error('Referência de preço vigente indisponível.'),{code:'price_reference_unavailable',status:409});
        if(priceCents>reference.effective_ceiling_cents)
          throw Object.assign(new Error('O preço continua acima do teto vigente.'),{code:'listing_price_above_ceiling',status:422,ceilingCents:reference.effective_ceiling_cents});
        const economy=productEconomyBasisPoints({prmCents:reference.prm_cents,listingPriceCents:priceCents});
        const updated=(await client.query(`UPDATE listings SET price_cents=$3,status='published',pause_reason=NULL,updated_at=now()
          WHERE id=$1 AND seller_id=$2 RETURNING id,price_cents,status,published_at,expires_at`,[listingId,sellerId,priceCents])).rows[0];
        await client.query(`INSERT INTO listing_price_history
          (listing_id,reference_cycle_id,previous_price_cents,new_price_cents,prm_cents,lowest_retail_cents,economy_basis_points,reason,actor_user_id)
          VALUES($1,$2,$3,$4,$5,$6,$7,'seller_price_adjustment',$8)`,
          [listingId,reference.id,listing.price_cents,priceCents,reference.prm_cents,reference.lowest_retail_cents,economy,sellerId]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'listing.price_adjusted','listing',$2,$3::jsonb)`,
          [sellerId,listingId,JSON.stringify({referenceCycleId:reference.id,previousPriceCents:listing.price_cents,newPriceCents:priceCents,ceilingCents:reference.effective_ceiling_cents})]);
        return { listing:updated, reference:{ id:reference.id,prmCents:reference.prm_cents,ceilingCents:reference.effective_ceiling_cents }, economyBasisPoints:economy };
      });
    },

    async reconcileReference({ referenceKey, validFrom }) {
      return database.transaction(async client => {
        const reference=(await client.query(`SELECT * FROM market_price_reference_cycles
          WHERE reference_key=$1 AND valid_from=$2 AND status IN('active','extended') FOR UPDATE`,[referenceKey,validFrom])).rows[0];
        if(!reference) return { checked:0, paused:0, protected:0, listingIds:[] };

        const rows=(await client.query(`SELECT l.id,l.seller_id,l.price_cents,l.status,l.expires_at,u.email AS seller_email
          FROM listings l JOIN users u ON u.id=l.seller_id
          WHERE l.kind='sale' AND l.status='published' AND l.price_cents IS NOT NULL
            AND l.price_reference_key=$1
            AND (l.expires_at IS NULL OR l.expires_at>now())
          FOR UPDATE OF l`,[referenceKey])).rows;

        let paused=0, protectedCount=0;
        const listingIds=[];
        for(const listing of rows){
          if(listing.price_cents<=reference.effective_ceiling_cents) continue;
          const active=(await client.query(`SELECT 1 FROM transactions WHERE listing_id=$1
            AND status=ANY($2::transaction_status[]) LIMIT 1`,[listing.id,protectedTransactionStatuses])).rowCount>0;
          if(active){ protectedCount++; continue; }
          const economy=productEconomyBasisPoints({prmCents:reference.prm_cents,listingPriceCents:listing.price_cents});
          await client.query(`UPDATE listings SET status='paused',pause_reason='price_adjustment_required',updated_at=now()
            WHERE id=$1 AND status='published'`,[listing.id]);
          await client.query(`INSERT INTO listing_price_history
            (listing_id,reference_cycle_id,previous_price_cents,new_price_cents,prm_cents,lowest_retail_cents,economy_basis_points,reason)
            VALUES($1,$2,$3,$3,$4,$5,$6,'monthly_reference_revalidation')`,
            [listing.id,reference.id,listing.price_cents,reference.prm_cents,reference.lowest_retail_cents,economy]);
          await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
            VALUES(NULL,'listing.price_adjustment_required','listing',$1,$2::jsonb)`,
            [listing.id,JSON.stringify({referenceCycleId:reference.id,ceilingCents:reference.effective_ceiling_cents})]);
          await client.query(`INSERT INTO notification_outbox(kind,recipient,payload,recipient_user_id)
            VALUES('general_reminder'::auth_token_kind,$1,$2::jsonb,$3)`,[listing.seller_email,JSON.stringify({channel:'email',event:'listing_price_adjustment_required',listingId:listing.id,referenceCycleId:reference.id,prmCents:reference.prm_cents,ceilingCents:reference.effective_ceiling_cents,expiresAt:listing.expires_at}),listing.seller_id]);
          paused++; listingIds.push(listing.id);
        }
        return { checked:rows.length, paused, protected:protectedCount, listingIds };
      });
    },
  });
}
