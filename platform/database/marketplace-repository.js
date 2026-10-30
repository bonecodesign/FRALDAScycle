import {institutionPublicationAllowed} from './institution-publication.js';
import { requireNewOperations } from './moderation-repository.js';
import { createOperationSupportRepository } from "./operation-support-repository.js";
import { lockPremiumAccount, adjustFreeListings, freePublicationAvailable } from './premium-repository.js';
async function existingCreation(client,input){
  if(!input.idempotencyKey)return null;
  const row=(await client.query('SELECT id,status,published_at,creation_fingerprint FROM listings WHERE seller_id=$1 AND creation_key=$2',[input.sellerId,input.idempotencyKey])).rows[0];
  if(!row)return null;
  if(row.creation_fingerprint!==input.creationFingerprint)throw Object.assign(new Error('A chave de envio já foi usada com outros dados.'),{code:'listing_creation_conflict',status:409});
  return {id:row.id,status:row.status,published_at:row.published_at,reused:true};
}
export function createMarketplaceRepository(database) {
  const publicColumns = `l.id, l.title, l.description, l.category, l.brand, l.model,
    l.package_condition, l.size, l.quantity, l.stock_units,
    (l.stock_units-COALESCE((SELECT sum(t.item_units)::integer FROM transactions t
      WHERE t.listing_id=l.id AND t.status<>'cancelled'),0))::integer AS available_units,
    l.kind, l.price_cents, l.status, l.city, l.state, l.latitude, l.longitude,
    l.published_at, l.created_at, l.updated_at, u.id AS seller_id, u.display_name AS seller_name,
    l.institution_id, i.public_name AS institution_name`;

  return Object.freeze({
    ...createOperationSupportRepository(database),
    creationByKey(sellerId,idempotencyKey,creationFingerprint){return existingCreation(database,{sellerId,idempotencyKey,creationFingerprint})},
    async resubmitListing({ sellerId, listingId, title, description, mediaKeys, expectedUpdatedAt }) {
      return database.transaction(async client => {
        await client.query("SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE", [sellerId]);
        await requireNewOperations(client, sellerId);
        const listing = (await client.query(
          "SELECT * FROM listings WHERE id=$1 AND seller_id=$2 FOR UPDATE", [listingId, sellerId],
        )).rows[0];
        const fail = (code, status, message) => Object.assign(new Error(message), { code, status });
        if (!listing) throw fail("listing_not_found", 404, "Anúncio não encontrado.");
        if (listing.status !== "removed" || new Date(listing.updated_at).getTime() !== Date.parse(expectedUpdatedAt)) {
          throw fail("listing_resubmission_conflict", 409, "O anúncio mudou. Carregue seus anúncios novamente.");
        }
        const decision = (await client.query(
          "SELECT outcome FROM listing_review_decisions WHERE listing_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1", [listingId],
        )).rows[0];
        if (decision?.outcome !== "removed") throw fail("listing_resubmission_unavailable", 409, "Solicite ao suporte a análise desta remoção.");
        const ongoing = (await client.query(
          "SELECT id FROM transactions WHERE listing_id=$1 AND status NOT IN ('cancelled','refunded','completed') LIMIT 1", [listingId],
        )).rows[0];
        if (ongoing) throw fail("listing_operation_active", 409, "Este anúncio possui uma operação em andamento.");
        if (!await institutionPublicationAllowed(client, listing)) throw fail("donation_institution_unavailable", 409, "A instituição não permite novas doações neste momento.");
        const previousMedia = (await client.query(
          "SELECT storage_key FROM listing_media WHERE listing_id=$1 ORDER BY position", [listingId],
        )).rows.map(item => item.storage_key);
        const nextMedia = mediaKeys ?? previousMedia;
        if (!nextMedia.length) throw fail("listing_media_required", 409, "Envie fotos antes de reenviar o anúncio.");
        if (title === listing.title && description === listing.description && JSON.stringify(nextMedia) === JSON.stringify(previousMedia)) {
          throw fail("listing_correction_required", 422, "Corrija o título, a descrição ou as fotos antes de reenviar.");
        }
        if (mediaKeys !== undefined) {
          await client.query("DELETE FROM listing_media WHERE listing_id=$1", [listingId]);
          for (const [position, key] of nextMedia.entries()) await client.query(
            "INSERT INTO listing_media(listing_id,storage_key,media_type,position) VALUES($1,$2,'image/webp',$3)", [listingId, key, position],
          );
        }
        const updated = (await client.query(
          "UPDATE listings SET title=$2,description=$3,status='review',published_at=NULL,expires_at=NULL,pause_reason=NULL,updated_at=now() WHERE id=$1 RETURNING id,status,updated_at",
          [listingId, title, description],
        )).rows[0];
        await client.query(
          "INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'listing.review.resubmitted','listing',$2,$3::jsonb)",
          [sellerId, listingId, JSON.stringify({ titleChanged: title !== listing.title,
            descriptionChanged: description !== listing.description, mediaReplaced: mediaKeys !== undefined })],
        );
        return updated;
      });
    },
    async ownListings(userId) {
      const result = await database.query(
        `SELECT l.id,l.title,l.description,l.brand,l.model,l.size,l.quantity,l.stock_units,l.kind,l.price_cents,l.status,
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
      query = null, kind = null, size = null, category = null,
      latitude = null, longitude = null, radiusKm = null,
      limit = 24, offset = 0, pilotBh = false,
    }) {
      const result = await database.query(
        `WITH candidates AS (
          SELECT ${publicColumns},
            (SELECT storage_key FROM listing_media WHERE listing_id = l.id ORDER BY position LIMIT 1) AS cover_key,
            CASE WHEN $5::double precision IS NULL THEN NULL ELSE
              6371 * acos(LEAST(1.0, GREATEST(-1.0,
                sin(radians($5::double precision)) * sin(radians(l.latitude)) +
                cos(radians($5::double precision)) * cos(radians(l.latitude)) *
                cos(radians(l.longitude) - radians($6::double precision))
              )))
            END AS distance_km
          FROM listings l JOIN users u ON u.id = l.seller_id LEFT JOIN institutions i ON i.id = l.institution_id
          WHERE l.status = 'published' AND l.expires_at IS NOT NULL AND l.expires_at > now() AND (l.kind<>'donation' OR i.status='active')
            AND ($1::text IS NULL OR to_tsvector('portuguese', l.title || ' ' || l.description) @@ plainto_tsquery('portuguese', $1))
            AND ($2::transaction_kind IS NULL OR l.kind = $2)
            AND ($3::text IS NULL OR l.size = $3)
            AND ($4::text IS NULL OR l.category = $4)
            AND ($10::boolean = false OR (lower(l.city) = 'belo horizonte' AND l.state = 'MG'))
        )
        SELECT * FROM candidates
        WHERE ($5::double precision IS NULL OR distance_km <= $7::double precision)
        ORDER BY distance_km ASC NULLS LAST, published_at DESC NULLS LAST, created_at DESC
        LIMIT $8 OFFSET $9`,
        [query, kind, size, category, latitude, longitude, radiusKm, limit, offset, pilotBh],
      );
      return result.rows;
    },

    async searchPage({
      query = null, kind = null, size = null, category = null,
      latitude = null, longitude = null, radiusKm = null,
      limit = 25, pilotBh = false, cursor = null,
    }) {
      const result = await database.query(
        `WITH raw_candidates AS (
          SELECT ${publicColumns},
            (SELECT storage_key FROM listing_media WHERE listing_id=l.id ORDER BY position LIMIT 1) AS cover_key,
            (SELECT count(*)::integer FROM listing_media WHERE listing_id=l.id) AS photo_count,
            EXISTS(SELECT 1 FROM manufacturer_catalog_entries mce
              JOIN manufacturer_catalog_batches mcb ON mcb.id=mce.batch_id AND mcb.status='active'
              WHERE lower(mce.category)=lower(l.category) AND lower(mce.brand)=lower(l.brand)
                AND lower(mce.model)=lower(l.model) AND lower(mce.size)=lower(l.size)) AS official_catalog_match,
            CASE WHEN $5::double precision IS NULL THEN NULL ELSE
              6371 * acos(LEAST(1.0, GREATEST(-1.0,
                sin(radians($5::double precision)) * sin(radians(l.latitude)) +
                cos(radians($5::double precision)) * cos(radians(l.latitude)) *
                cos(radians(l.longitude) - radians($6::double precision))
              )))
            END AS distance_km
          FROM listings l JOIN users u ON u.id=l.seller_id LEFT JOIN institutions i ON i.id=l.institution_id
          WHERE l.status='published' AND l.expires_at IS NOT NULL AND l.expires_at>now()
            AND (l.kind<>'donation' OR i.status='active')
            AND ($1::text IS NULL OR to_tsvector('portuguese',l.title||' '||l.description) @@ plainto_tsquery('portuguese',$1))
            AND ($2::transaction_kind IS NULL OR l.kind=$2)
            AND ($3::text IS NULL OR l.size=$3)
            AND ($4::text IS NULL OR l.category=$4)
            AND ($9::boolean=false OR (lower(l.city)='belo horizonte' AND l.state='MG'))
        ), candidates AS (
          SELECT *,
            0.4 * ((CASE WHEN title<>'' THEN 1 ELSE 0 END + CASE WHEN description<>'' THEN 1 ELSE 0 END
              + CASE WHEN kind IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN category<>'' THEN 1 ELSE 0 END
              + CASE WHEN brand<>'' THEN 1 ELSE 0 END + CASE WHEN model<>'' THEN 1 ELSE 0 END
              + CASE WHEN size<>'' THEN 1 ELSE 0 END + CASE WHEN quantity>0 THEN 1 ELSE 0 END
              + CASE WHEN package_condition<>'' THEN 1 ELSE 0 END + CASE WHEN city<>'' THEN 1 ELSE 0 END
              + CASE WHEN state<>'' THEN 1 ELSE 0 END + CASE WHEN kind<>'sale' OR price_cents>=0 THEN 1 ELSE 0 END) / 12.0)
            + 0.3 * CASE WHEN photo_count>=3 THEN 1 WHEN photo_count=2 THEN 0.75 WHEN photo_count=1 THEN 0.5 ELSE 0 END
            + 0.2 * CASE WHEN official_catalog_match THEN 1 ELSE 0 END
            + 0.1 * CASE WHEN now()-updated_at<=interval '7 days' THEN 1 WHEN now()-updated_at<=interval '30 days' THEN 0.75
              WHEN now()-updated_at<=interval '90 days' THEN 0.5 WHEN now()-updated_at<=interval '180 days' THEN 0.25 ELSE 0 END
            AS quality_score
          FROM raw_candidates
        ), ranked AS (
          SELECT *, round((0.5*quality_score + 0.5*CASE WHEN distance_km IS NULL THEN 0 WHEN distance_km<=5 THEN 1
            WHEN distance_km<=15 THEN 2.0/3 WHEN distance_km<=30 THEN 1.0/3 ELSE 0 END)::numeric,6)::double precision AS general_score
          FROM candidates
        )
        SELECT * FROM ranked
        WHERE ($5::double precision IS NULL OR distance_km<=$7::double precision)
          AND ($10::boolean=false OR
            (general_score<$11::double precision OR
              (general_score=$11::double precision AND (published_at<$12::timestamptz OR
                (published_at=$12::timestamptz AND (created_at<$13::timestamptz OR
                  (created_at=$13::timestamptz AND id>$14::uuid))))))
          )
        ORDER BY general_score DESC,published_at DESC,created_at DESC,id ASC
        LIMIT $8`,
        [query,kind,size,category,latitude,longitude,radiusKm,limit,pilotBh,
          Boolean(cursor),cursor?.generalScore ?? null,cursor?.publishedAt ?? null,
          cursor?.createdAt ?? null,cursor?.id ?? null],
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
         WHERE l.id = $1 AND l.status = 'published' AND l.expires_at IS NOT NULL AND l.expires_at > now() AND (l.kind<>'donation' OR i.status='active')
         GROUP BY l.id, u.id, i.id`,
        [id],
      );
      return result.rows[0] ?? null;
    },

    async create(input) {
      if (!input.mediaKeys?.length) throw Object.assign(new Error("Envie pelo menos uma foto do produto."), { code: "listing_media_required", status: 422 });
      return database.transaction(async (client) => {
        const premium = await lockPremiumAccount(client, input.sellerId);
        const previous=await existingCreation(client,input);if(previous)return previous;
        const stockUnits=Number.isInteger(input.stockUnits)?input.stockUnits:1;
        const stockLimit=premium.entitlement.benefitsActive?5:3;
        if(stockUnits<1||stockUnits>stockLimit)throw Object.assign(new Error(premium.entitlement.benefitsActive?'O Premium permite até cinco unidades iguais por anúncio.':'O plano gratuito permite até três unidades iguais por anúncio.'),{code:'listing_stock_plan_limit',status:409});
        await requireNewOperations(client,input.sellerId);
        if(!await institutionPublicationAllowed(client,{kind:input.kind,institution_id:input.institutionId,package_condition:input.packageCondition}))throw Object.assign(new Error('A instituição não permite novas doações neste momento.'),{code:'donation_institution_unavailable',status:409});
        await adjustFreeListings(client, input.sellerId, premium);
        if (!await freePublicationAvailable(client, input.sellerId, premium)) throw Object.assign(new Error('O plano gratuito permite até três anúncios publicados. Pause um anúncio antes de publicar outro.'), { code: 'free_listing_limit', status: 409 });
        const result = await client.query(
          `INSERT INTO listings
            (seller_id, title, description, category, brand, model, package_condition,
             open_package_attested, size, quantity, stock_units, kind, price_cents, status,
             city, state, latitude, longitude, institution_id, published_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$19::listing_status,$14,$15,$16,$17,$18,CASE WHEN $19::listing_status='published' THEN now() ELSE NULL END)
           RETURNING id, status, published_at`,
          [input.sellerId, input.title, input.description, input.category, input.brand,
           input.model, input.packageCondition, input.openPackageAttested, input.size,
           input.quantity, stockUnits, input.kind, input.priceCents, input.city, input.state,
           input.latitude, input.longitude, input.institutionId, 'review'],
        );
        for (const [position, storageKey] of (input.mediaKeys ?? []).entries()) {
          await client.query(
            `INSERT INTO listing_media (listing_id, storage_key, media_type, position)
             VALUES ($1,$2,'image/webp',$3)`,
            [result.rows[0].id, storageKey, position],
          );
        }
        if(input.idempotencyKey)await client.query('UPDATE listings SET creation_key=$2,creation_fingerprint=$3 WHERE id=$1',[result.rows[0].id,input.idempotencyKey,input.creationFingerprint]);
        return result.rows[0];
      });
    },

    async activeInstitution(institutionId) {
      const result = await database.query(
        "SELECT id, open_packages_accepted FROM institutions WHERE id = $1 AND status = 'active' AND accepting_donations = true",
        [institutionId],
      );
      return result.rows[0] ?? null;
    },

    async favorites(userId) {
      const result = await database.query(
        `SELECT ${publicColumns} FROM favorites f
         JOIN listings l ON l.id = f.listing_id JOIN users u ON u.id = l.seller_id
         LEFT JOIN institutions i ON i.id = l.institution_id
         WHERE f.user_id = $1 AND l.status = 'published' AND l.expires_at IS NOT NULL AND l.expires_at > now() AND (l.kind<>'donation' OR i.status='active') ORDER BY f.created_at DESC`,
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

    async startTransaction({ buyerId, listingId, itemUnits = 1 }) {
      return database.transaction(async (client) => {
        const owner = (await client.query('SELECT seller_id FROM listings WHERE id=$1', [listingId])).rows[0];
        if (!owner) throw Object.assign(new Error('Anúncio não está disponível.'), { code: 'listing_unavailable', status: 409 });
        await client.query('SELECT id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR NO KEY UPDATE', [[buyerId,owner.seller_id]]);
        const premium = await lockPremiumAccount(client, owner.seller_id);
        await requireNewOperations(client,buyerId);
        await requireNewOperations(client,owner.seller_id);
        await adjustFreeListings(client, owner.seller_id, premium);
        const listing=(await client.query(`SELECT id,seller_id,kind,price_cents,stock_units FROM listings
          WHERE id=$1 AND seller_id<>$2 AND status='published' AND kind='sale'
            AND expires_at IS NOT NULL AND expires_at>now() FOR UPDATE`,[listingId,buyerId])).rows[0];
        if(!listing)throw Object.assign(new Error('Anúncio não está disponível.'),{code:'listing_unavailable',status:409});
        const committed=Number((await client.query(`SELECT COALESCE(sum(item_units),0)::integer AS units FROM transactions
          WHERE listing_id=$1 AND status<>'cancelled'`,[listingId])).rows[0].units);
        if(committed+itemUnits>listing.stock_units)throw Object.assign(new Error('A quantidade solicitada não está mais disponível.'),{code:'listing_stock_unavailable',status:409});
        const result = await client.query(
          `INSERT INTO transactions (listing_id, buyer_id, seller_id, status, amount_cents, item_units)
           VALUES ($1,$2,$3,'initiated',$4,$5)
           RETURNING id, listing_id, status, amount_cents, item_units, created_at`,
          [listingId,buyerId,listing.seller_id,listing.price_cents*itemUnits,itemUnits],
        );
        if(committed+itemUnits===listing.stock_units)await client.query("UPDATE listings SET status='unavailable',updated_at=now() WHERE id=$1",[listingId]);
        return result.rows[0];
      });
    },

    async chatAccess({ actorId, transactionId }) {
      const result = await database.query(
        `SELECT t.id, t.status, l.kind,
           EXISTS (
             SELECT 1 FROM payment_intents p
             WHERE p.transaction_id = t.id AND p.status = 'paid'
               AND p.amount_cents = t.amount_cents AND p.provider_reference IS NOT NULL
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
