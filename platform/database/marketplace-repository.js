import {institutionPublicationAllowed} from './institution-publication.js';
import { requireNewOperations } from './moderation-repository.js';
import { createOperationSupportRepository } from "./operation-support-repository.js";
import { lockPremiumAccount, adjustFreeListings, freePublicationAvailable } from './premium-repository.js';
export function createMarketplaceRepository(database) {
  const publicColumns = `l.id, l.title, l.description, l.category, l.brand, l.model,
    l.package_condition, l.size, l.quantity,
    l.kind, l.price_cents, l.status, l.city, l.state, l.latitude, l.longitude,
    l.published_at, l.created_at, u.id AS seller_id, u.display_name AS seller_name,
    l.institution_id, i.public_name AS institution_name`;

  return Object.freeze({
    ...createOperationSupportRepository(database),
    async ownListings(userId) {
      const result = await database.query(
        `SELECT l.id,l.title,l.brand,l.model,l.size,l.quantity,l.kind,l.price_cents,l.status,
                l.created_at,l.updated_at,l.published_at,
                review.outcome AS review_outcome,review.reason AS review_reason,review.created_at AS reviewed_at
         FROM listings l
         LEFT JOIN LATERAL (
           SELECT outcome,reason,created_at FROM listing_review_decisions
           WHERE listing_id=l.id ORDER BY created_at DESC LIMIT 1
         ) review ON true
         WHERE l.seller_id=$1 ORDER BY l.updated_at DESC,l.id`, [userId],
      );
      return result.rows;
    },
    async search({
      query = null, kind = null, size = null,
      latitude = null, longitude = null, radiusKm = null,
      limit = 24, offset = 0,
    }) {
      const result = await database.query(
        `WITH candidates AS (
          SELECT ${publicColumns},
            (SELECT storage_key FROM listing_media WHERE listing_id = l.id ORDER BY position LIMIT 1) AS cover_key,
            CASE WHEN $4::double precision IS NULL THEN NULL ELSE
              6371 * acos(LEAST(1.0, GREATEST(-1.0,
                sin(radians($4::double precision)) * sin(radians(l.latitude)) +
                cos(radians($4::double precision)) * cos(radians(l.latitude)) *
                cos(radians(l.longitude) - radians($5::double precision))
              )))
            END AS distance_km
          FROM listings l JOIN users u ON u.id = l.seller_id LEFT JOIN institutions i ON i.id = l.institution_id
          WHERE l.status = 'published' AND (l.kind<>'donation' OR i.status='active')
            AND ($1::text IS NULL OR to_tsvector('portuguese', l.title || ' ' || l.description) @@ plainto_tsquery('portuguese', $1))
            AND ($2::transaction_kind IS NULL OR l.kind = $2)
            AND ($3::text IS NULL OR l.size = $3)
        )
        SELECT * FROM candidates
        WHERE ($4::double precision IS NULL OR distance_km <= $6::double precision)
        ORDER BY distance_km ASC NULLS LAST, published_at DESC NULLS LAST, created_at DESC
        LIMIT $7 OFFSET $8`,
        [query, kind, size, latitude, longitude, radiusKm, limit, offset],
      );
      return result.rows;
    },

    async detail(id) {
      const result = await database.query(
        `SELECT ${publicColumns},
          COALESCE(json_agg(json_build_object('storageKey', m.storage_key, 'position', m.position)
            ORDER BY m.position) FILTER (WHERE m.id IS NOT NULL), '[]') AS media
         FROM listings l JOIN users u ON u.id = l.seller_id LEFT JOIN institutions i ON i.id = l.institution_id
         LEFT JOIN listing_media m ON m.listing_id = l.id
         WHERE l.id = $1 AND l.status = 'published' AND (l.kind<>'donation' OR i.status='active')
         GROUP BY l.id, u.id, i.id`,
        [id],
      );
      return result.rows[0] ?? null;
    },

    async create(input) {
      return database.transaction(async (client) => {
        const premium = await lockPremiumAccount(client, input.sellerId);
        await requireNewOperations(client,input.sellerId);
        if(!await institutionPublicationAllowed(client,{kind:input.kind,institution_id:input.institutionId,package_condition:input.packageCondition}))throw Object.assign(new Error('A instituição não permite novas doações neste momento.'),{code:'donation_institution_unavailable',status:409});
        await adjustFreeListings(client, input.sellerId, premium);
        if (!await freePublicationAvailable(client, input.sellerId, premium)) throw Object.assign(new Error('O plano gratuito permite até três anúncios publicados. Pause um anúncio antes de publicar outro.'), { code: 'free_listing_limit', status: 409 });
        const result = await client.query(
          `INSERT INTO listings
            (seller_id, title, description, category, brand, model, package_condition,
             open_package_attested, size, quantity, kind, price_cents, status,
             city, state, latitude, longitude, institution_id, published_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$18::listing_status,$13,$14,$15,$16,$17,CASE WHEN $18::listing_status='published' THEN now() ELSE NULL END)
           RETURNING id, status, published_at`,
          [input.sellerId, input.title, input.description, input.category, input.brand,
           input.model, input.packageCondition, input.openPackageAttested, input.size,
           input.quantity, input.kind, input.priceCents, input.city, input.state,
           input.latitude, input.longitude, input.institutionId, (input.mediaKeys?.length ? 'review' : 'published')],
        );
        for (const [position, storageKey] of (input.mediaKeys ?? []).entries()) {
          await client.query(
            `INSERT INTO listing_media (listing_id, storage_key, media_type, position)
             VALUES ($1,$2,'image/webp',$3)`,
            [result.rows[0].id, storageKey, position],
          );
        }
        return result.rows[0];
      });
    },

    async activeInstitution(institutionId) {
      const result = await database.query(
        "SELECT id, open_packages_accepted FROM institutions WHERE id = $1 AND status = 'active'",
        [institutionId],
      );
      return result.rows[0] ?? null;
    },

    async favorites(userId) {
      const result = await database.query(
        `SELECT ${publicColumns} FROM favorites f
         JOIN listings l ON l.id = f.listing_id JOIN users u ON u.id = l.seller_id
         LEFT JOIN institutions i ON i.id = l.institution_id
         WHERE f.user_id = $1 AND l.status = 'published' AND (l.kind<>'donation' OR i.status='active') ORDER BY f.created_at DESC`,
        [userId],
      );
      return result.rows;
    },

    async addFavorite(userId, listingId) {
      await database.query(
        "INSERT INTO favorites (user_id, listing_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [userId, listingId],
      );
    },

    async removeFavorite(userId, listingId) {
      await database.query("DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2", [userId, listingId]);
    },

    async startTransaction({ buyerId, listingId }) {
      return database.transaction(async (client) => {
        const owner = (await client.query('SELECT seller_id FROM listings WHERE id=$1', [listingId])).rows[0];
        if (!owner) throw Object.assign(new Error('Anúncio não está disponível.'), { code: 'listing_unavailable', status: 409 });
        await client.query('SELECT id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR NO KEY UPDATE', [[buyerId,owner.seller_id]]);
        const premium = await lockPremiumAccount(client, owner.seller_id);
        await requireNewOperations(client,buyerId);
        await requireNewOperations(client,owner.seller_id);
        await adjustFreeListings(client, owner.seller_id, premium);
        const listing = await client.query(
          `UPDATE listings SET status = 'unavailable', updated_at = now()
           WHERE id = $1 AND seller_id <> $2 AND status = 'published' AND kind = 'sale'
           RETURNING id, seller_id, kind, price_cents`,
          [listingId, buyerId],
        );
        if (!listing.rows[0]) throw Object.assign(new Error("Anúncio não está disponível."), { code: "listing_unavailable", status: 409 });
        const result = await client.query(
          `INSERT INTO transactions (listing_id, buyer_id, seller_id, status, amount_cents)
           VALUES ($1,$2,$3,'initiated',$4)
           RETURNING id, listing_id, status, created_at`,
          [listingId, buyerId, listing.rows[0].seller_id, listing.rows[0].price_cents],
        );
        return result.rows[0];
      });
    },

    async chatAccess({ actorId, transactionId }) {
      const result = await database.query(
        `SELECT t.id, t.status, l.kind,
           EXISTS (
             SELECT 1 FROM payment_intents p
             WHERE p.transaction_id = t.id AND p.status IN ('authorized','paid')
           ) AS payment_confirmed
         FROM transactions t JOIN listings l ON l.id = t.listing_id
         WHERE t.id = $1 AND $2 IN (t.buyer_id, t.seller_id)`,
        [transactionId, actorId],
      );
      return result.rows[0] ?? null;
    },

    async completeTransaction() {
      // Fail closed until independent proof validation and receiver approval are persisted.
      throw Object.assign(new Error("Conclusão aguarda validação do comprovante e aprovação do recebedor. Procure o suporte."), {
        code: "receipt_confirmation_not_configured", status: 503,
      });
    },

  });
}
