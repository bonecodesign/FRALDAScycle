import { lstat, readFile } from "node:fs/promises";
import { isMainModule } from "../packages/contracts/main-module.js";

// BR baseline from read-only Supabase inventory (2026-11-22): 166 public tables.
// If a future authorized migration removes tables, review and adjust this floor explicitly.
export const MIN_PUBLIC_TABLES = 166;
export const REQUIRED_BACKUP_TABLES = Object.freeze([
  "public.schema_migrations",
  "public.users",
  "public.listings",
  "public.transactions",
  "auth.users",
  "storage.buckets",
  "storage.objects",
]);

function fail(reason) { return new Error(`BACKUP_TOC_${reason}`); }

// Works on the human-readable TOC produced by PostgreSQL 17 "pg_restore --list".
// This is a structural check only: it does not open rows or validate a full restore.
export function inspectBackupToc(toc, {
  minimumPublicTables = MIN_PUBLIC_TABLES,
  requiredTables = REQUIRED_BACKUP_TABLES,
} = {}) {
  if (typeof toc !== "string" || toc.length === 0 || toc.length > 4_000_000) {
    throw fail("INVALID_CONTENT");
  }
  if (!/^;\s*Format:\s*CUSTOM\s*$/m.test(toc)) throw fail("FORMAT_UNSUPPORTED");
  if (!/^;\s*TOC Entries:\s*\d+\s*$/m.test(toc)) throw fail("HEADER_INVALID");
  if (!Number.isSafeInteger(minimumPublicTables) || minimumPublicTables < 1 ||
      !Array.isArray(requiredTables) || requiredTables.length === 0) {
    throw fail("EXPECTATIONS_INVALID");
  }

  const schemaDefinitions = new Set();
  const dataEntries = new Set();
  for (const line of toc.split(/\r?\n/)) {
    // Format: "1234; <catalog-id> <object-id> TABLE DATA <schema> <name> <owner>"
    // Reject comment lines; only count real pg_restore TOC records.
    const match = /^\d+;\s+\d+\s+\d+\s+(TABLE DATA|TABLE)\s+(\S+)\s+(\S+)\s+\S+/.exec(line);
    if (!match) continue;
    const key = `${match[2]}.${match[3]}`;
    if (match[1] === "TABLE") schemaDefinitions.add(key);
    else dataEntries.add(key);
  }
  const publicCount = [...schemaDefinitions].filter(value => value.startsWith("public.")).length;
  if (publicCount < minimumPublicTables) throw fail("PUBLIC_TABLE_COUNT_LOW");

  for (const key of requiredTables) {
    if (typeof key !== "string" || !/^[a-z_]+\.[a-z_]+$/.test(key)) {
      throw fail("EXPECTATIONS_INVALID");
    }
    if (!schemaDefinitions.has(key) || !dataEntries.has(key)) {
      throw fail("ESSENTIAL_TABLE_MISSING");
    }
  }
  return Object.freeze({
    status: "BACKUP_TOC_STRUCTURE_PRESENT",
    format: "CUSTOM",
    publicTableDefinitions: publicCount,
    essentialDataEntries: requiredTables.length,
    rowDataValidated: false,
    restorationValidated: false,
    storageObjectContentsValidated: false,
  });
}

export async function inspectPrivateTocFile(path) {
  let metadata;
  try { metadata = await lstat(path); } catch { throw fail("FILE_UNAVAILABLE"); }
  if (!metadata.isFile() || metadata.size === 0 ||
      metadata.size > 4_000_000 || (metadata.mode & 0o077) !== 0) {
    throw fail("PRIVATE_FILE_REQUIRED");
  }
  return inspectBackupToc(await readFile(path, "utf8"));
}

if (isMainModule(import.meta.url)) {
  inspectPrivateTocFile(process.argv[2]).then(report => {
    console.log(JSON.stringify(report));
  }).catch(() => {
    // Do not print paths, data, a TOC, database settings, or other environment values.
    console.error("BACKUP_TOC_VALIDATION_FAILED");
    process.exitCode = 1;
  });
}
