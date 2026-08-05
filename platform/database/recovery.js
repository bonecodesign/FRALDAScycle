import { spawn } from "node:child_process";
import { resolve } from "node:path";

function dumpPath(value) {
  if (!value) throw new Error("DATABASE_DUMP_PATH is required");
  const path = resolve(value);
  if (!path.endsWith(".dump")) throw new Error("DATABASE_DUMP_PATH must end with .dump");
  return path;
}

function databaseEnvironment(value) {
  const url = new URL(value);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("Database URL must use PostgreSQL");
  return {
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    ...(url.searchParams.get("sslmode") ? { PGSSLMODE: url.searchParams.get("sslmode") } : {}),
  };
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
  return Object.freeze({
    command: "pg_restore",
    args: ["--clean", "--if-exists", "--exit-on-error", "--no-owner", "--no-privileges", "--dbname", databaseEnvironment(env.RESTORE_DATABASE_URL).PGDATABASE, dumpPath(env.DATABASE_DUMP_PATH)],
    env: databaseEnvironment(env.RESTORE_DATABASE_URL),
  });
}

export function executePlan(plan, { spawnImpl = spawn } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawnImpl(plan.command, plan.args, {
      stdio: "inherit",
      env: { ...process.env, ...plan.env },
      shell: false,
    });
    child.once("error", () => reject(new Error(`${plan.command} is unavailable`)));
    child.once("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${plan.command} failed with exit code ${code}`)));
  });
}

const mode = process.argv[2];
if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  const plan = mode === "backup" ? createBackupPlan() : mode === "restore" ? createRestorePlan() : null;
  if (!plan) {
    console.error("Usage: node database/recovery.js <backup|restore>");
    process.exitCode = 2;
  } else {
    executePlan(plan).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}
