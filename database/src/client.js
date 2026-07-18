import pg from "pg";

const { Pool } = pg;

export function createDatabasePool(connectionString) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  return new Pool({
    connectionString,
    max: 10,
  });
}

export async function runMigrations(pool, schema) {
  await pool.query(schema);
}
