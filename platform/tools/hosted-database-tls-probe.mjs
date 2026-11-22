import { createDatabase } from "../database/client.js";
import { loadConfig } from "../apps/api/config.js";
import { isMainModule } from "../packages/contracts/main-module.js";
import { assessSupabaseReadiness } from "./supabase-readiness.mjs";

// PostgreSQL reports SSL negotiated by the exact backend executing this SELECT.
// No user records, secrets, certificates, migration data, or private endpoints are read.
export const HOSTED_TLS_QUERY = `SELECT current_database() AS database_name,
  current_setting('ssl') AS server_ssl,
  ssl AS tls_active,
  version AS tls_version,
  bits AS cipher_bits
  FROM pg_catalog.pg_stat_ssl
  WHERE pid = pg_backend_pid()`;

export function evaluateHostedTlsSession(rows) {
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error("HOSTED_TLS_SESSION_UNAVAILABLE");
  }
  const row = rows[0];
  if (row.database_name !== "postgres") throw new Error("HOSTED_TLS_DATABASE_MISMATCH");
  if (row.server_ssl !== "on" || row.tls_active !== true) {
    throw new Error("HOSTED_TLS_NOT_NEGOTIATED");
  }
  if (!["TLSv1.2", "TLSv1.3"].includes(row.tls_version) ||
      !Number.isInteger(row.cipher_bits) || row.cipher_bits < 128) {
    throw new Error("HOSTED_TLS_INADEQUATE");
  }
  return Object.freeze({
    status: "PASS_CLIENT_TLS_ONLY",
    tlsVersion: row.tls_version,
    cipherBits: row.cipher_bits,
    projectReference: "urbrtnenrsjvgqjhfhdj",
    checkedAtUtc: new Date().toISOString(),
    scope: "Read-only API database client; no backup, recovery or public launch verified",
  });
}

// No implicit scheduled action: one explicit opt-in, no production, no service activation.
export async function runHostedTlsProbe({
  env = process.env, createDb = createDatabase,
} = {}) {
  if (env.HOSTED_TLS_PROBE_APPROVED !== "READ_ONLY_HOMOLOGATION" ||
      env.NODE_ENV === "production" || env.PILOT_BH_ENABLED === "true") {
    throw new Error("HOSTED_TLS_PROBE_NOT_AUTHORIZED");
  }
  const readiness = assessSupabaseReadiness(env);
  if (!readiness.enabled || !readiness.ready) {
    throw new Error("HOSTED_TLS_PROBE_CONFIGURATION_REJECTED");
  }

  // Reuse exactly the FraldaCycle API's configuration and PostgreSQL client.
  // databasePoolConfig() also rejects malformed CA, wrong project and TLS URL overrides.
  const config = loadConfig(env);
  const db = createDb(config);
  try {
    const result = await db.query(HOSTED_TLS_QUERY);
    return evaluateHostedTlsSession(result.rows);
  } finally {
    await db.close();
  }
}

if (isMainModule(import.meta.url)) {
  try {
    console.log(JSON.stringify(await runHostedTlsProbe(), null, 2));
  } catch {
    // Never display a raw pg/Node error: it can include a connection string,
    // hostname, username, certificate paths or other environment details.
    console.error("HOSTED_TLS_PROBE_FAILED: inspect privately on approved backend");
    process.exitCode = 1;
  }
}
