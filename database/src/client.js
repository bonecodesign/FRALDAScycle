import pg from "pg";

export { PostgresListingRepository } from "./listing-repository.js";
export { PostgresNotificationRepository } from "./notification-repository.js";
export { PostgresUserRepository } from "./user-repository.js";

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
