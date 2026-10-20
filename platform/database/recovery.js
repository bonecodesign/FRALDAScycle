import { spawn } from "node:child_process";
import { isMainModule } from "../packages/contracts/main-module.js";
import { chmod, link, lstat, mkdtemp, rm, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

const PG_TLS_ENVIRONMENT = new Set([
  "PGSSLROOTCERT", "PGSSLCERT", "PGSSLKEY", "PGSSLCRL", "PGSSLCRLDIR",
  "PGSSLMINPROTOCOLVERSION", "PGSSLMAXPROTOCOLVERSION",
]);
const VALID_SSL_MODES = new Set(["disable", "allow", "prefer", "require", "verify-ca", "verify-full"]);

function dumpPath(value) {
  if (!value) throw new Error("DATABASE_DUMP_PATH is required");
  const path = resolve(value);
  if (!path.endsWith(".dump")) throw new Error("DATABASE_DUMP_PATH must end with .dump");
  return path;
}

function databaseEnvironment(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Database URL is invalid"); }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("Database URL must use PostgreSQL");
  if (!url.hostname || !url.pathname || url.pathname === "/") {
    throw new Error("Database URL must include host and database name");
  }
  if (url.hash) throw new Error("Database URL fragments are not supported");
  const queryKeys = [...url.searchParams.keys()];
  if (queryKeys.some(key => key !== "sslmode")) throw new Error("Database URL contains an unsupported parameter");
  if (queryKeys.filter(key => key === "sslmode").length > 1) throw new Error("Database URL must contain at most one sslmode");
  const sslmode = url.searchParams.get("sslmode");
  if (queryKeys.length && !VALID_SSL_MODES.has(sslmode)) {
    throw new Error("Database URL sslmode is invalid");
  }
  let username, password, database;
  try {
    username = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
    database = decodeURIComponent(url.pathname.slice(1));
  } catch { throw new Error("Database URL contains invalid percent encoding"); }
  if (!username) throw new Error("Database URL must include username");
  if (!database) throw new Error("Database URL must include host and database name");
  const port = Number(url.port || "5432");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Database URL port is invalid");
  }
  return {
    PGHOST: url.hostname.replace(/^\[|\]$/g, ""),
    PGPORT: String(port),
    PGUSER: username,
    PGPASSWORD: password,
    PGDATABASE: database,
    ...(sslmode ? { PGSSLMODE: sslmode } : {}),
  };
}

function databaseIdentity(value) {
  const environment = databaseEnvironment(value);
  const hostname = environment.PGHOST.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
  const canonicalHost = ['localhost', '127.0.0.1', '::1'].includes(hostname) ? 'loopback' : hostname;
  return `${canonicalHost}:${environment.PGPORT}/${environment.PGDATABASE}`;
}

export function createBackupPlan(env = process.env) {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  return Object.freeze({
    command: "pg_dump",
    args: ["--format=custom", "--compress=9", "--no-owner", "--no-privileges", "--file", dumpPath(env.DATABASE_DUMP_PATH)],
    env: databaseEnvironment(env.DATABASE_URL),
  });
}

export function createRestorePlan(env = process.env) {
  if (env.CONFIRM_DATABASE_RESTORE !== "RESTORE") throw new Error("Set CONFIRM_DATABASE_RESTORE=RESTORE to authorize restoration");
  if (!env.RESTORE_DATABASE_URL) throw new Error("RESTORE_DATABASE_URL is required");
  if (env.DATABASE_URL && databaseIdentity(env.DATABASE_URL) === databaseIdentity(env.RESTORE_DATABASE_URL)) {
    throw new Error("RESTORE_DATABASE_URL must target a database different from DATABASE_URL");
  }
  return Object.freeze({
    command: "pg_restore",
    args: ["--clean", "--if-exists", "--exit-on-error", "--single-transaction", "--no-owner", "--no-privileges", "--dbname", databaseEnvironment(env.RESTORE_DATABASE_URL).PGDATABASE, dumpPath(env.DATABASE_DUMP_PATH)],
    env: databaseEnvironment(env.RESTORE_DATABASE_URL),
  });
}

export function executePlan(plan, { spawnImpl = spawn, parentEnv = process.env } = {}) {
  const inheritedEnv = Object.fromEntries(Object.entries(parentEnv)
    .filter(([name]) => name !== "DATABASE_URL" && name !== "RESTORE_DATABASE_URL")
    .filter(([name]) => !/^PG/i.test(name) || PG_TLS_ENVIRONMENT.has(name)));
  return new Promise((resolvePromise, reject) => {
    const child = spawnImpl(plan.command, plan.args, {
      stdio: "inherit",
      env: { ...inheritedEnv, ...plan.env },
      shell: false,
      umask: 0o077,
    });
    child.once("error", () => reject(new Error(`${plan.command} is unavailable`)));
    child.once("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${plan.command} failed with exit code ${code}`)));
  });
}

export async function executeBackupPlan(plan, options = {}) {
  if (plan?.command !== "pg_dump") throw new Error("A pg_dump plan is required");
  const fileIndex = plan.args.indexOf("--file");
  if (fileIndex < 0) throw new Error("Backup plan must define an output file");
  const destination = plan.args[fileIndex + 1];
  if (!destination) throw new Error("Backup plan must define an output file");

  const privateDirectory = await mkdtemp(join(dirname(destination), `.${basename(destination)}.tmp-`));
  try {
    await chmod(privateDirectory, 0o700);
    const temporaryDump = join(privateDirectory, basename(destination));
    const args = [...plan.args];
    args[fileIndex + 1] = temporaryDump;
    await executePlan({ ...plan, args }, options);

    const output = await stat(temporaryDump);
    if (!output.isFile() || output.size === 0 || (output.mode & 0o077) !== 0) {
      throw new Error("Backup output must be a non-empty private file");
    }
    // link() publishes atomically and fails if the destination already exists.
    await link(temporaryDump, destination);
  } finally {
    await rm(privateDirectory, { recursive: true, force: true });
  }
}

export async function executeRestorePlan(plan, options = {}) {
  if (plan?.command !== "pg_restore") throw new Error("A pg_restore plan is required");
  const dumpFile = plan.args.at(-1);
  if (typeof dumpFile !== "string" || !dumpFile.endsWith(".dump")) {
    throw new Error("Restore plan must define a dump file");
  }
  let dump;
  try { dump = await lstat(dumpFile); }
  catch { throw new Error("Restore dump is unavailable"); }
  if (!dump.isFile() || dump.size === 0 || (dump.mode & 0o077) !== 0) {
    throw new Error("Restore dump must be a non-empty private regular file");
  }
  return executePlan(plan, options);
}

const mode = process.argv[2];
if (isMainModule(import.meta.url)) {
  const plan = mode === "backup" ? createBackupPlan() : mode === "restore" ? createRestorePlan() : null;
  if (!plan) {
    console.error("Usage: node database/recovery.js <backup|restore>");
    process.exitCode = 2;
  } else {
    const execution = mode === "backup" ? executeBackupPlan(plan)
      : mode === "restore" ? executeRestorePlan(plan) : null;
    execution.catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}
