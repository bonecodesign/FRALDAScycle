import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isMainModule } from "../packages/contracts/main-module.js";
import { createBackupPlan } from "../database/recovery.js";
import { validateBackupProtectionFiles } from "./dropbox-encrypted-upload.mjs";

// The PostgreSQL dump contains the storage metadata tables, NOT the underlying
// uploaded file bytes. Never declare a database-only archive complete while
// buckets or object rows exist. A future blob-backup implementation is required.
export const STORAGE_INVENTORY_QUERY =
  "SELECT CASE WHEN EXISTS (SELECT 1 FROM storage.buckets) " +
  "OR EXISTS (SELECT 1 FROM storage.objects) " +
  "THEN 'STORAGE_EXTERNAL_COPY_REQUIRED' ELSE 'STORAGE_EMPTY_DB_ONLY' END;";

const execFileAsync = promisify(execFile);
function fail(reason) { return new Error(`STORAGE_COVERAGE_${reason}`); }

export function inspectStorageInventoryOutput(stdout) {
  if (typeof stdout !== "string" || stdout.length > 128) throw fail("UNTRUSTED_RESPONSE");
  const status = stdout.trim();
  if (status === "STORAGE_EXTERNAL_COPY_REQUIRED") throw fail("EXTERNAL_FILES_NOT_BACKED_UP");
  if (status !== "STORAGE_EMPTY_DB_ONLY") throw fail("UNTRUSTED_RESPONSE");
  return Object.freeze({
    status: "STORAGE_EMPTY_DB_ONLY",
    bucketAndObjectRowsConfirmedAbsent: true,
    databaseBackupExecuted: false,
    storageBinaryBackupValidated: false,
  });
}

export async function verifyNoUnprotectedStorageBinaries(env = process.env, {
  execute = execFileAsync,
} = {}) {
  // Same strict project/credential/CA checks as the private uploader, before
  // connecting to the hosted database. No secrets appear in command arguments.
  await validateBackupProtectionFiles(env);
  const plan = createBackupPlan(env);
  if (typeof env.FC_BACKUP_WORKDIR !== "string" ||
      !env.FC_BACKUP_WORKDIR.trim()) throw fail("WORKDIR_UNAVAILABLE");
  const commandEnvironment = {
    PATH: env.PATH || process.env.PATH,
    HOME: env.HOME || process.env.HOME,
    FC_BACKUP_WORKDIR: env.FC_BACKUP_WORKDIR,
    PGSSLROOTCERT: env.PGSSLROOTCERT,
    ...plan.env,
  };
  const args = [
    "--no-psqlrc", "--no-align", "--tuples-only", "--quiet", "--no-password",
    "--set", "ON_ERROR_STOP=1", "--command", STORAGE_INVENTORY_QUERY,
  ];
  let result;
  try {
    result = await execute("psql", args, {
      env: commandEnvironment, encoding: "utf8", timeout: 30_000,
      maxBuffer: 1024, windowsHide: true,
    });
  } catch {
    // Neither stderr nor underlying execution errors may be shown: libpq can
    // include hostname/user/connection details in errors and Github logs.
    throw fail("DATABASE_INVENTORY_UNAVAILABLE");
  }
  return inspectStorageInventoryOutput(result?.stdout);
}

if (isMainModule(import.meta.url)) {
  verifyNoUnprotectedStorageBinaries().then(report => {
    console.log(JSON.stringify(report));
  }).catch(() => {
    console.error("STORAGE_COVERAGE_PREFLIGHT_FAILED");
    process.exitCode = 1;
  });
}
