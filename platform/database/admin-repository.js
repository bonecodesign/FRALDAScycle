import { lockPremiumAccount, freePublicationAvailable } from "./premium-repository.js";
import { requireNewOperations } from "./moderation-repository.js";
import { institutionPublicationAllowed } from "./institution-publication.js";

export function createAdminRepository(database) {
  return Object.freeze({
    async webhookSnapshot({ actorUserId, limit = 50, offset = 0 }) { return database.transaction(async client => {
      const summary = (await client.query(`SELECT
        (SELECT count(*)::integer FROM payment_webhook_events) AS payment_event_count,
        (SELECT count(*)::integer FROM logistics_webhook_events) AS logistics_event_count`)).rows[0];
      const items = (await client.query(`SELECT domain,id,event_type,occurred_at,processed_at FROM (
        SELECT 'payment'::text AS domain,id,event_type,occurred_at,processed_at FROM payment_webhook_events
        UNION ALL
        SELECT 'logistics'::text AS domain,id,event_type,occurred_at,processed_at FROM logistics_webhook_events
      ) events ORDER BY processed_at DESC,id LIMIT $1 OFFSET $2`, [limit, offset])).rows;
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'admin.webhook_events.read','webhook_event','list',$2::jsonb)`, [actorUserId, JSON.stringify({ count: items.length })]);
      return { summary, items };
    }); },
    async accessSnapshot({ actorUserId }) { return database.transaction(async client => {
      const items = (await client.query(`SELECT role,count(*)::integer AS user_count,
        count(*) FILTER(WHERE disabled_at IS NULL)::integer AS active_count,
        count(*) FILTER(WHERE email_verified_at IS NOT NULL)::integer AS email_verified_count
        FROM users GROUP BY role ORDER BY role`)).rows;
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'admin.access_snapshot.read','user','roles',$2::jsonb)`, [actorUserId, JSON.stringify({ roleCount: items.length })]);
      return { items };
    }); },
    async catalogSnapshot({ actorUserId, query = null, status = null, limit = 50, offset = 0 }) { return database.transaction(async client => {
      const summary = (await client.query(`SELECT count(*)::integer AS listing_count,
        count(*) FILTER(WHERE status='published')::integer AS published_count,
        count(*) FILTER(WHERE status='review')::integer AS review_count,
        count(*) FILTER(WHERE status='paused')::integer AS paused_count,
        COALESCE(sum(quantity),0)::bigint AS unit_count FROM listings`)).rows[0];
      const items = (await client.query(`SELECT l.id,l.title,l.brand,l.size,l.quantity,l.kind,l.price_cents,l.status,l.created_at,u.display_name AS seller_name
        FROM listings l JOIN users u ON u.id=l.seller_id
        WHERE ($1::text IS NULL OR l.title ILIKE '%'||$1||'%' OR l.brand ILIKE '%'||$1||'%' OR u.display_name ILIKE '%'||$1||'%')
          AND ($2::listing_status IS NULL OR l.status=$2)
        ORDER BY l.created_at DESC,l.id LIMIT $3 OFFSET $4`, [query, status, limit, offset])).rows;
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'admin.catalog_snapshot.read','listing','list',$2::jsonb)`, [actorUserId, JSON.stringify({ count: items.length, filtered: Boolean(query || status) })]);
      return { summary, items };
    }); },
    async listingReviewDetail({ actorUserId, listingId }) { return database.transaction(async client => {
      const listing = (await client.query(
        `SELECT l.id,l.seller_id,l.title,l.description,l.brand,l.model,l.size,l.quantity,l.kind,
                l.price_cents,l.status,l.created_at,l.updated_at,u.display_name AS seller_name
         FROM listings l JOIN users u ON u.id=l.seller_id WHERE l.id=$1`, [listingId],
      )).rows[0];
      if (!listing) return null;
      const media = (await client.query(
        `SELECT storage_key,media_type,position FROM listing_media
         WHERE listing_id=$1 ORDER BY position`, [listingId],
      )).rows;
      await client.query(
        `INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
         VALUES($1,'listing.review.opened','listing',$2,$3::jsonb)`,
        [actorUserId, listingId, JSON.stringify({ status: listing.status, mediaCount: media.length })],
      );
      return { listing, media };
    }); },
    async reviewListing({ actorUserId, listingId, outcome, reason, expectedUpdatedAt }) { return database.transaction(async client => {
      let premium;
      if (outcome === "published") {
        const controls = (await client.query(
          "SELECT domain,paused FROM operational_controls WHERE domain IN ('global','marketplace','donations') ORDER BY domain FOR SHARE",
        )).rows;
        if (controls.some(item => item.paused && item.domain !== "donations")) {
          throw Object.assign(new Error("A publicação de anúncios está temporariamente pausada."), { code: "operational_paused", status: 503 });
        }
        const reference = (await client.query("SELECT seller_id FROM listings WHERE id=$1", [listingId])).rows[0];
        if (!reference) return null;
        // Match publication/resubmission lock order: account first, then listing.
        premium = await lockPremiumAccount(client, reference.seller_id);
        const seller = (await client.query("SELECT disabled_at FROM users WHERE id=$1", [reference.seller_id])).rows[0];
        if (!seller || seller.disabled_at) throw Object.assign(new Error("A conta do anunciante está suspensa ou indisponível."), { code: "seller_account_unavailable", status: 403 });
        await requireNewOperations(client, reference.seller_id);
        premium.donationsPaused = controls.some(item => item.domain === "donations" && item.paused);
      }
      const current = (await client.query(
        "SELECT id,seller_id,status,updated_at,kind,institution_id,package_condition FROM listings WHERE id=$1 FOR UPDATE", [listingId],
      )).rows[0];
      if (!current) return null;
      if (current.seller_id === actorUserId) throw Object.assign(new Error("O anúncio deve ser revisado por outra pessoa."), { code: "independent_listing_review_required", status: 403 });
      if (current.status !== "review") throw Object.assign(new Error("O anúncio não está mais aguardando revisão."), { code: "listing_review_conflict", status: 409 });
      if (outcome === "published") {
        if (current.kind === "donation" && premium.donationsPaused) throw Object.assign(new Error("Novas doações estão temporariamente pausadas."), { code: "operational_paused", status: 503 });
        if (!await institutionPublicationAllowed(client, current)) throw Object.assign(new Error("A instituição não permite esta doação neste momento."), { code: "donation_institution_unavailable", status: 409 });
        if (!await freePublicationAvailable(client, current.seller_id, premium)) throw Object.assign(new Error("O plano gratuito permite até três anúncios publicados. O anunciante precisa liberar uma vaga antes da aprovação."), { code: "free_listing_limit", status: 409 });
        if (!expectedUpdatedAt || new Date(expectedUpdatedAt).getTime() !== new Date(current.updated_at).getTime()) {
          throw Object.assign(new Error("O anúncio mudou durante a confirmação das fotos. Abra a revisão novamente."), { code: "listing_review_conflict", status: 409 });
        }
        const mediaCount = Number((await client.query(
          "SELECT count(*)::integer AS count FROM listing_media WHERE listing_id=$1", [listingId],
        )).rows[0]?.count ?? 0);
        if (mediaCount < 1) throw Object.assign(new Error("Não é possível aprovar sem mídia registrada."), { code: "listing_media_required", status: 409 });
      }
      const listing = (await client.query(
        `UPDATE listings SET status=$2::listing_status,
           published_at=CASE WHEN $2='published' THEN now() ELSE NULL END,
           expires_at=CASE WHEN $2='published' THEN now()+interval '30 days' ELSE NULL END,
           pause_reason=NULL,updated_at=now()
         WHERE id=$1 RETURNING id,status,published_at,expires_at,updated_at`, [listingId, outcome],
      )).rows[0];
      await client.query(
        `INSERT INTO listing_review_decisions(listing_id,reviewer_id,outcome,reason)
         VALUES($1,$2,$3::listing_status,$4)`, [listingId, actorUserId, outcome, reason],
      );
      await client.query(
        `INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
         VALUES($1,$2,'listing',$3,$4::jsonb)`,
        [actorUserId, outcome === "published" ? "listing.review.approved" : "listing.review.rejected",
          listingId, JSON.stringify({ previousStatus: current.status, outcome, reason })],
      );
      return listing;
    }); },
    async overviewSnapshot({ actorUserId, limit = 20 }) { return database.transaction(async client => {
      const summary = (await client.query(`SELECT
        (SELECT count(*)::integer FROM users WHERE disabled_at IS NULL) AS active_user_count,
        (SELECT count(*)::integer FROM listings) AS listing_count,
        (SELECT count(*)::integer FROM transactions) AS transaction_count,
        (SELECT count(*)::integer FROM transactions WHERE status='completed') AS completed_transaction_count,
        (SELECT count(*)::integer FROM transactions WHERE status IN('proposed','reserved','payment_pending','paid','in_delivery','donation_confirmed')) AS active_transaction_count,
        (SELECT count(*)::integer FROM transactions WHERE status IN('cancelled','disputed','refunded')) AS exception_transaction_count,
        (SELECT COALESCE(sum(amount_cents),0)::bigint FROM payment_intents WHERE status='paid') AS paid_volume_cents,
        (SELECT count(*)::integer FROM payment_intents WHERE status IN('failed','cancelled','refunded')) AS payment_exception_count,
        (SELECT count(*)::integer FROM payment_cases WHERE status NOT IN('rejected','completed','failed')) AS open_payment_case_count,
        (SELECT count(*)::integer FROM shipments) AS shipment_count,
        (SELECT count(*)::integer FROM shipments WHERE status='delivered') AS delivered_shipment_count,
        (SELECT count(*)::integer FROM shipments WHERE status IN('failed','cancelled')) AS shipment_exception_count,
        (SELECT count(*)::integer FROM operational_controls WHERE paused=true) AS paused_domain_count`)).rows[0];
      const items = (await client.query(`SELECT t.id,l.kind,t.status,t.amount_cents,t.created_at
        FROM transactions t JOIN listings l ON l.id=t.listing_id
        ORDER BY t.created_at DESC,t.id LIMIT $1`, [limit])).rows;
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'admin.overview_snapshot.read','operations','summary',$2::jsonb)`, [actorUserId, JSON.stringify({ count: items.length })]);
      return { summary, items };
    }); },
    async financeSnapshot({ actorUserId, limit = 50, offset = 0 }) { return database.transaction(async client => {
      const summary=(await client.query(`SELECT count(*)::integer AS payment_count,
        COALESCE(sum(p.amount_cents) FILTER(WHERE p.status='paid'),0)::bigint AS paid_volume_cents,
        count(*) FILTER(WHERE p.status='paid')::integer AS paid_count,
        count(*) FILTER(WHERE p.status IN('pending','authorized','provider_pending'))::integer AS pending_count,
        count(*) FILTER(WHERE p.status IN('failed','cancelled','refunded') OR EXISTS(
          SELECT 1 FROM payment_cases pc WHERE pc.payment_intent_id=p.id AND pc.status NOT IN('rejected','completed','failed')
        ))::integer AS exception_count
        FROM payment_intents p`)).rows[0];
      const items=(await client.query(`SELECT p.id,p.transaction_id,p.method,p.amount_cents,p.platform_fee_cents,p.delivery_fee_cents,p.seller_amount_cents,p.status,p.created_at,
        (SELECT count(*)::integer FROM payment_cases pc WHERE pc.payment_intent_id=p.id AND pc.status NOT IN('rejected','completed','failed')) AS open_cases,
        cpo.status AS courier_payout_status,cpo.courier_amount_cents
        FROM payment_intents p LEFT JOIN courier_payout_obligations cpo ON cpo.payment_intent_id=p.id
        ORDER BY p.created_at DESC,p.id LIMIT $1 OFFSET $2`,[limit,offset])).rows;
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'admin.finance_snapshot.read','payment_intent','list',$2::jsonb)`, [actorUserId, JSON.stringify({ count: items.length })]);
      return { summary, items };
    }); },
    async logisticsSnapshot({ actorUserId, limit = 50, offset = 0 }) { return database.transaction(async client => {
      const summary=(await client.query(`SELECT count(*)::integer AS shipment_count,
        count(*) FILTER(WHERE status='awaiting_pickup')::integer AS awaiting_pickup_count,
        count(*) FILTER(WHERE status='assigned')::integer AS assigned_count,
        count(*) FILTER(WHERE status IN('picked_up','in_transit'))::integer AS in_transit_count,
        count(*) FILTER(WHERE status='delivered')::integer AS delivered_count,
        count(*) FILTER(WHERE status IN('failed','cancelled'))::integer AS exception_count
        FROM shipments`)).rows[0];
      const items=(await client.query(`SELECT s.id,s.transaction_id,s.exchange_leg,s.mode,s.status,s.courier_id,u.display_name AS courier_name,s.estimated_delivery_at,s.created_at,
        EXISTS(SELECT 1 FROM delivery_proofs p WHERE p.shipment_id=s.id) AS proof_recorded
        FROM shipments s LEFT JOIN users u ON u.id=s.courier_id ORDER BY s.created_at DESC,s.id LIMIT $1 OFFSET $2`,[limit,offset])).rows;
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'admin.logistics_snapshot.read','shipment','list',$2::jsonb)`, [actorUserId, JSON.stringify({ count: items.length })]);
      return { summary, items };
    }); },
    async listAuditEvents({ limit = 50, offset = 0 }) {
      const result = await database.query(
        `SELECT a.id, a.actor_user_id, u.display_name AS actor_name, a.action,
                a.entity_type, a.entity_id, a.metadata, a.occurred_at
         FROM audit_events a LEFT JOIN users u ON u.id = a.actor_user_id
         ORDER BY a.occurred_at DESC, a.id DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      return result.rows;
    },

    async listUsers({ query = null, role = null, status = null, limit = 50, offset = 0 }) {
      const result = await database.query(
        `SELECT id, email, phone, display_name, role, email_verified_at,
                disabled_at, created_at, updated_at
         FROM users
         WHERE ($1::text IS NULL OR display_name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%' OR phone ILIKE '%' || $1 || '%')
           AND ($2::user_role IS NULL OR role = $2)
           AND ($3::text IS NULL OR ($3 = 'active' AND disabled_at IS NULL) OR ($3 = 'suspended' AND disabled_at IS NOT NULL))
         ORDER BY created_at DESC LIMIT $4 OFFSET $5`,
        [query, role, status, limit, offset],
      );
      return result.rows;
    },

    async setUserStatus({ actorUserId, targetUserId, status, reason }) {
      return database.transaction(async (client) => {
        const current = await client.query(
          "SELECT id, disabled_at FROM users WHERE id = $1 FOR UPDATE",
          [targetUserId],
        );
        if (!current.rows[0]) return null;
        const wasSuspended = Boolean(current.rows[0].disabled_at);
        const updated = await client.query(
          `UPDATE users SET disabled_at = CASE WHEN $2 = 'suspended' THEN COALESCE(disabled_at, now()) ELSE NULL END,
                   updated_at = now()
           WHERE id = $1
           RETURNING id, email, phone, display_name, role, email_verified_at, disabled_at, updated_at`,
          [targetUserId, status],
        );
        if (status === "suspended") {
          await client.query(
            "UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
            [targetUserId],
          );
        }
        await client.query(
          `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, $2, 'user', $3, $4::jsonb)`,
          [
            actorUserId,
            status === "suspended" ? "user.suspended" : "user.reactivated",
            targetUserId,
            JSON.stringify({ previousStatus: wasSuspended ? "suspended" : "active", newStatus: status, reason }),
          ],
        );
        return updated.rows[0];
      });
    },

    async createInvitation({ actorUserId, email, displayName, role, tokenHash, token, expiresAt }) {
      return database.transaction(async (client) => {
        const existing = await client.query(
          "SELECT id FROM users WHERE email = $1 LIMIT 1",
          [email],
        );
        if (existing.rows[0]) return null;
        await client.query(
          `UPDATE admin_invitations SET consumed_at = now()
           WHERE email = $1 AND consumed_at IS NULL`,
          [email],
        );
        const created = await client.query(
          `INSERT INTO admin_invitations
             (email, display_name, role, staff_access_level, token_hash, invited_by, expires_at)
           VALUES ($1,$2,$3::user_role,CASE WHEN $3='admin' THEN 4 WHEN $3='moderator' THEN 1 ELSE NULL END,$4,$5,$6)
           RETURNING id, email, display_name, role, staff_access_level, expires_at, created_at`,
          [email, displayName, role, tokenHash, actorUserId, expiresAt],
        );
        const invitation = created.rows[0];
        await client.query(
          `INSERT INTO notification_outbox (kind, recipient, payload)
           VALUES ('admin_invitation'::auth_token_kind, $1, $2::jsonb)`,
          [email, JSON.stringify({
            token, channel: "email", displayName, role,
            expiresAt: expiresAt.toISOString(),
          })],
        );
        await client.query(
          `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, 'admin.invitation.created', 'admin_invitation', $2, $3::jsonb)`,
          [actorUserId, invitation.id, JSON.stringify({ email, role, expiresAt })],
        );
        return invitation;
      });
    },

    async acceptInvitation({ tokenHash, passwordHash }) {
      return database.transaction(async (client) => {
        const consumed = await client.query(
          `UPDATE admin_invitations SET consumed_at = now()
           WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
           RETURNING id, email, display_name, role, staff_access_level, invited_by`,
          [tokenHash],
        );
        const invitation = consumed.rows[0];
        if (!invitation) return null;
        const created = await client.query(
          `INSERT INTO users (email, password_hash, display_name, role, staff_access_level, email_verified_at)
           VALUES ($1,$2,$3,$4::user_role,$5,now())
           RETURNING id, email, phone, display_name, role, staff_access_level, email_verified_at, created_at`,
          [invitation.email, passwordHash, invitation.display_name, invitation.role, invitation.staff_access_level],
        );
        const user = created.rows[0];
        await client.query(
          `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, 'admin.invitation.accepted', 'user', $2, $3::jsonb)`,
          [invitation.invited_by, user.id, JSON.stringify({ invitationId: invitation.id, role: invitation.role })],
        );
        return user;
      });
    },

    async listUserSessions({ userId, currentSessionId }) {
      const result = await database.query(
        `SELECT id, user_agent, created_at, expires_at, revoked_at,
                (id = $2::uuid) AS current
         FROM sessions
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
         ORDER BY current DESC, created_at DESC`,
        [userId, currentSessionId],
      );
      return result.rows;
    },

    async revokeOtherSessions({ actorUserId, currentSessionId }) {
      return database.transaction(async (client) => {
        const revoked = await client.query(
          `UPDATE sessions SET revoked_at = now()
           WHERE user_id = $1 AND id <> $2::uuid AND revoked_at IS NULL AND expires_at > now()
           RETURNING id`,
          [actorUserId, currentSessionId],
        );
        await client.query(
          `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1::uuid, 'sessions.others.revoked', 'user', $1::text, $2::jsonb)`,
          [actorUserId, JSON.stringify({ revokedCount: revoked.rowCount })],
        );
        return revoked.rowCount;
      });
    },

    async changeUserRole({ actorUserId, targetUserId, role }) {
      return database.transaction(async (client) => {
        const current = await client.query(
          "SELECT id, role FROM users WHERE id = $1 FOR UPDATE",
          [targetUserId],
        );
        if (!current.rows[0]) return null;
        const previousRole = current.rows[0].role;
        const updated = await client.query(
          `UPDATE users SET role = $2::user_role, updated_at = now()
           WHERE id = $1 RETURNING id, email, phone, display_name, role, updated_at`,
          [targetUserId, role],
        );
        await client.query(
          `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, 'user.role.changed', 'user', $2, $3::jsonb)`,
          [actorUserId, targetUserId, JSON.stringify({ previousRole, newRole: role })],
        );
        return updated.rows[0];
      });
    },
  });
}
