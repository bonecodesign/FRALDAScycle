import pg from "pg";
import { loadConfig } from "../apps/api/config.js";
import { databasePoolConfig } from "./connection-security.js";

const { Pool } = pg;

export function createDatabase(config = loadConfig()) {
  const pool = new Pool(databasePoolConfig(config));

  return Object.freeze({
    query(text, values) {
      return pool.query(text, values);
    },
    async transaction(operation) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await operation(client);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async readiness() {
      const result = await pool.query("SELECT current_database() AS database, now() AS checked_at");
      return { database: result.rows[0].database, checkedAt: result.rows[0].checked_at };
    },
    close() {
      return pool.end();
    },
  });
}
