import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createDatabase } from "./client.js";

const migrationsRoot = resolve(import.meta.dirname, "migrations");

export function checksum(content) {
  return createHash("sha256").update(content).digest("hex");
}

export async function discoverMigrations(root = migrationsRoot) {
  const names = (await readdir(root))
    .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
    .sort((left, right) => left.localeCompare(right, "en"));
  return Promise.all(names.map(async (name) => {
    const path = resolve(root, name);
    const sql = await readFile(path, "utf8");
    return { name: basename(path), sql, checksum: checksum(sql) };
  }));
}

export async function migrate(database, migrations = null) {
  const migrationList = migrations ?? await discoverMigrations();
  await database.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const applied = await database.query("SELECT name, checksum FROM schema_migrations ORDER BY name");
  const known = new Map(applied.rows.map((row) => [row.name, row.checksum]));

  for (const migration of migrationList) {
    if (known.has(migration.name)) {
      if (known.get(migration.name) !== migration.checksum) {
        throw new Error(`Applied migration changed: ${migration.name}`);
      }
      continue;
    }
    await database.transaction(async (client) => {
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

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
