export function createMarketplaceRepository(database) {
  const publicColumns = `l.id, l.title, l.description, l.category, l.brand, l.model,
    l.package_condition, l.size, l.quantity,
    l.kind, l.price_cents, l.status, l.city, l.state, l.latitude, l.longitude,
    l.published_at, l.created_at, u.id AS seller_id, u.display_name AS seller_name`;

  return Object.freeze({
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
          FROM listings l JOIN users u ON u.id = l.seller_id
          WHERE l.status = 'published'
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
         FROM listings l JOIN users u ON u.id = l.seller_id
         LEFT JOIN listing_media m ON m.listing_id = l.id
         WHERE l.id = $1 AND l.status = 'published'
         GROUP BY l.id, u.id`,
        [id],
      );
      return result.rows[0] ?? null;
    },

    async create(input) {
      return database.transaction(async (client) => {
        const result = await client.query(
          `INSERT INTO listings
            (seller_id, title, description, category, brand, model, package_condition,
             open_package_attested, size, quantity, kind, price_cents, status,
             city, state, latitude, longitude, published_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'published',$13,$14,$15,$16,now())
           RETURNING id, status, published_at`,
          [input.sellerId, input.title, input.description, input.category, input.brand,
           input.model, input.packageCondition, input.openPackageAttested, input.size,
           input.quantity, input.kind, input.priceCents, input.city, input.state,
           input.latitude, input.longitude],
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

    async favorites(userId) {
      const result = await database.query(
        `SELECT ${publicColumns} FROM favorites f
         JOIN listings l ON l.id = f.listing_id JOIN users u ON u.id = l.seller_id
         WHERE f.user_id = $1 AND l.status = 'published' ORDER BY f.created_at DESC`,
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
        const listing = await client.query(
          `UPDATE listings SET status = 'unavailable', updated_at = now()
           WHERE id = $1 AND seller_id <> $2 AND status = 'published'
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

    async cancelTransaction({ actorId, transactionId }) {
      return database.transaction(async (client) => {
        const tx = await client.query(
          `UPDATE transactions SET status = 'cancelled', updated_at = now()
           WHERE id = $1 AND $2 IN (buyer_id, seller_id)
             AND status NOT IN ('completed','cancelled','refunded')
           RETURNING id, listing_id, status`, [transactionId, actorId],
        );
        if (!tx.rows[0]) throw Object.assign(new Error("Operação não pode ser cancelada."), { code: "transaction_not_cancellable", status: 409 });
        await client.query("UPDATE listings SET status = 'published', updated_at = now() WHERE id = $1 AND status = 'unavailable'", [tx.rows[0].listing_id]);
        return tx.rows[0];
      });
    },

    async completeTransaction({ actorId, transactionId }) {
      return database.transaction(async (client) => {
        const tx = await client.query(
          `UPDATE transactions SET status = 'completed', updated_at = now()
           WHERE id = $1 AND $2 IN (buyer_id, seller_id)
             AND status NOT IN ('completed','cancelled','refunded')
           RETURNING id, listing_id, status`, [transactionId, actorId],
        );
        if (!tx.rows[0]) throw Object.assign(new Error("Operação não pode ser finalizada."), { code: "transaction_not_completable", status: 409 });
        await client.query("UPDATE listings SET status = 'completed', updated_at = now() WHERE id = $1", [tx.rows[0].listing_id]);
        return tx.rows[0];
      });
    },
  });
}
