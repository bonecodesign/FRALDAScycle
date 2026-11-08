import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createDatabase } from "./client.js";
import { isMainModule } from "../packages/contracts/main-module.js";

const migrationsRoot = resolve(import.meta.dirname, "migrations");

// These two pairs predate the version-uniqueness rule. Keep their exact
// historical filenames and checksums intact; they are not a precedent for
// introducing any new collision.
const LEGACY_VERSION_PAIRS = Object.freeze({
  "44": Object.freeze(["044_monthly_pricing_listing_lifecycle.sql", "044_notification_auth_token_binding.sql"]),
  "61": Object.freeze(["061_child_profile_active_only_retention.sql", "061_pilot_invitations.sql"]),
});
const MIGRATION_NAME = /^(\\d+)_[a-z0-9_-]+\\.sql$/i;

export function assertUniqueMigrationVersions(names) {
  if (!Array.isArray(names) || names.some(name => typeof name !== "string" || !MIGRATION_NAME.test(name))) {
    throw new Error("Invalid migration filename list");
  }
  const byVersion = new Map();
  for (const name of names) {
    const version = BigInt(name.match(MIGRATION_NAME)[1]).toString();
    const previous = byVersion.get(version) ?? [];
    previous.push(name);
    byVersion.set(version, previous);
  }
  for (const [version, group] of byVersion) {
    if (group.length < 2) continue;
    const legacy = LEGACY_VERSION_PAIRS[version];
    if (legacy && group.length === legacy.length && legacy.every(name => group.includes(name))) continue;
    throw new Error(`Migration version collision ${version}: ${group.join(", ")}. Use a unique unused numeric prefix.`);
  }
  return true;
}

export function checksum(content) {
  return createHash("sha256").update(content).digest("hex");
}

export async function discoverMigrations(root = migrationsRoot) {
  const names = (await readdir(root))
    .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
    .sort((left, right) => left.localeCompare(right, "en"));
  assertUniqueMigrationVersions(names);
  return Promise.all(names.map(async (name) => {
    const path = resolve(root, name);
    const sql = await readFile(path, "utf8");
    return { name: basename(path), sql, checksum: checksum(sql) };
  }));
}

export async function migrate(database, migrations = null) {
  const migrationList = migrations ?? await discoverMigrations();
  assertUniqueMigrationVersions(migrationList.map(({ name }) => name));
  for (const migration of migrationList) {
    await database.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock($1)", [1_180_162_025]);
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          name text PRIMARY KEY,
          checksum char(64) NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      const applied = await client.query("SELECT name, checksum FROM schema_migrations ORDER BY name");
      const known = new Map(applied.rows.map((row) => [row.name, row.checksum]));

      if (known.has(migration.name)) {
        if (known.get(migration.name) !== migration.checksum) {
          throw new Error(`Applied migration changed: ${migration.name}`);
        }
        return;
      }
      await client.query(migration.sql);
      await client.query(
        "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
        [migration.name, migration.checksum],
      );
    });
  }
  return migrationList.map(({ name }) => name);
}

async function main() {
  const database = createDatabase();
  try {
    const names = await migrate(database);
    console.log(`PostgreSQL migrations verified: ${names.join(", ")}`);
  } finally {
    await database.close();
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
