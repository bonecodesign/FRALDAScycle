function mapListing(row) {
  return {
    id: row.id,
    ownerId: row.ownerId,
    type: row.type,
    status: row.status,
    brand: row.brand,
    diaperSize: row.diaperSize,
    units: row.units,
    priceCents: row.priceCents,
    photoUrl: row.photoUrl,
    location: { city: row.city, state: row.state },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const returning = `
  id,
  owner_id AS "ownerId",
  type,
  status,
  brand,
  diaper_size AS "diaperSize",
  units,
  price_cents AS "priceCents",
  photo_url AS "photoUrl",
  city,
  state,
  created_at AS "createdAt",
  updated_at AS "updatedAt"`;

export class PostgresListingRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create(listing) {
    const { rows } = await this.pool.query(
      `INSERT INTO listings (
        owner_id, type, status, brand, diaper_size, units, price_cents, photo_url, city, state
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING ${returning}`,
      [
        listing.ownerId,
        listing.type,
        listing.status ?? "pending",
        listing.brand,
        listing.diaperSize,
        listing.units,
        listing.priceCents ?? null,
        listing.photoUrl ?? null,
        listing.location.city,
        listing.location.state,
      ],
    );

    return mapListing(rows[0]);
  }

  async list({ city, state, type, status = "active" } = {}) {
    const values = [status];
    const conditions = ["status = $1"];

    for (const [column, value] of Object.entries({ city, state, type })) {
      if (value) {
        values.push(value);
        conditions.push(`${column} = $${values.length}`);
      }
    }

    const { rows } = await this.pool.query(
      `SELECT ${returning}
       FROM listings
       WHERE ${conditions.join(" AND ")}
       ORDER BY created_at DESC`,
      values,
    );

    return rows.map(mapListing);
  }

  async listByOwner(ownerId) {
    const { rows } = await this.pool.query(
      `SELECT ${returning}
       FROM listings
       WHERE owner_id = $1
       ORDER BY created_at DESC`,
      [ownerId],
    );

    return rows.map(mapListing);
  }

  async updateStatusById(id, status) {
    const { rows } = await this.pool.query(
      `UPDATE listings
       SET status = $2, updated_at = now()
       WHERE id = $1
       RETURNING ${returning}`,
      [id, status],
    );

    return rows[0] ? mapListing(rows[0]) : null;
  }

  async deleteByIdAndOwner(id, ownerId) {
    const { rowCount } = await this.pool.query(
      "DELETE FROM listings WHERE id = $1 AND owner_id = $2",
      [id, ownerId],
    );

    return rowCount > 0;
  }
}
