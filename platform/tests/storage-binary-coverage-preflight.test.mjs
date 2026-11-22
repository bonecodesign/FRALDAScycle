import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  inspectStorageInventoryOutput, STORAGE_INVENTORY_QUERY, verifyNoUnprotectedStorageBinaries,
} from "../tools/storage-binary-coverage-preflight.mjs";

function configured(ca) {
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: "bonecodesign/fraldacycle-backups-private",
    NODE_ENV: "homologation",
    PRIVATE_BACKUP_RUNNER_APPROVED: "MANUAL_HOMOLOGATION",
    OFFSITE_BACKUP_UPLOAD_APPROVED: "PRIVATE_RUNNER_MANUAL",
    DATABASE_URL: "postgresql://postgres:synthetic-test@db.urbrtnenrsjvgqjhfhdj.supabase.co:5432/postgres?sslmode=verify-full",
    DATABASE_DUMP_PATH: "/private/synthetic.dump",
    RECOVERY_ARCHIVE_KEY_B64: randomBytes(32).toString("base64"),
    PGSSLROOTCERT: ca,
    FC_BACKUP_WORKDIR: "/private/disposable-workdir",
    PATH: process.env.PATH,
    DROPBOX_APP_KEY: "test-app-key",
    DROPBOX_APP_SECRET: "test-app-secret",
    DROPBOX_REFRESH_TOKEN: "test-refresh-token",
  };
}

async function withFixture(action) {
  const directory = await mkdtemp(join(tmpdir(), "fc344-preflight-"));
  const ca = join(directory, "ca.crt");
  await writeFile(ca, "-----BEGIN CERTIFICATE-----\nsynthetic-fixture\n-----END CERTIFICATE-----\n",
    { mode: 0o600 });
  try { await action(configured(ca), { ca }); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test("requires empty Storage buckets AND objects to allow database-only archives", () => {
  assert.match(STORAGE_INVENTORY_QUERY, /storage\.buckets/);
  assert.match(STORAGE_INVENTORY_QUERY, /storage\.objects/);
  assert.match(STORAGE_INVENTORY_QUERY, /EXISTS/);
  const report = inspectStorageInventoryOutput("STORAGE_EMPTY_DB_ONLY\n");
  assert.equal(report.bucketAndObjectRowsConfirmedAbsent, true);
  assert.equal(report.storageBinaryBackupValidated, false);
  assert.equal(report.databaseBackupExecuted, false);
});

test("blocks any bucket or object inventory including future empty buckets", () => {
  assert.throws(() => inspectStorageInventoryOutput("STORAGE_EXTERNAL_COPY_REQUIRED\n"),
    /STORAGE_COVERAGE_EXTERNAL_FILES_NOT_BACKED_UP/);
  for (const stdout of ["", "STORAGE_EMPTY_DB_ONLY\nSTORAGE_EMPTY_DB_ONLY\n",
    "0", "t", "STORAGE_EMPTY_DB_ONLY additional", "STORAGE_EMPTY_DB_ONLY\nleak",
    "a".repeat(200)]) {
    assert.throws(() => inspectStorageInventoryOutput(stdout),
      /STORAGE_COVERAGE_UNTRUSTED_RESPONSE/);
  }
});

test("safe SQL query is read-only and never prints Storage filenames or private contents", () => {
  assert.match(STORAGE_INVENTORY_QUERY, /^SELECT CASE WHEN/);
  assert.doesNotMatch(STORAGE_INVENTORY_QUERY, /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|COPY|pg_read_file)\b/i);
  assert.doesNotMatch(STORAGE_INVENTORY_QUERY, /object\.name|storage\.objects\.name|SELECT \*/i);
});

test("preflight calls PostgreSQL without password/connection string in args or logs", async () => {
  await withFixture(async env => {
    let calls = 0;
    const result = await verifyNoUnprotectedStorageBinaries(env, {
      execute: async (command, args, options) => {
        calls++;
        assert.equal(command, "psql");
        assert.ok(args.includes("--no-password"));
        assert.ok(args.includes("ON_ERROR_STOP=1"));
        assert.ok(args.includes(STORAGE_INVENTORY_QUERY));
        assert.equal(args.join(" ").includes("synthetic-test"), false);
        assert.equal(options.env.PGSSLMODE, "verify-full");
        assert.equal(options.env.PGPASSWORD, "synthetic-test");
        assert.equal(options.env.PGSSLROOTCERT, env.PGSSLROOTCERT);
        assert.equal(options.env.DATABASE_URL, undefined);
        assert.equal(options.env.DROPBOX_APP_SECRET, undefined);
        assert.equal(options.env.RECOVERY_ARCHIVE_KEY_B64, undefined);
        assert.equal(options.maxBuffer, 1024);
        return { stdout: "STORAGE_EMPTY_DB_ONLY\n", stderr: "" };
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.status, "STORAGE_EMPTY_DB_ONLY");
  });
});

test("wrong project, bad CA, missing password reject before connecting", async () => {
  await withFixture(async (env, { ca }) => {
    let requests = 0;
    const execute = async () => { requests++; return { stdout: "STORAGE_EMPTY_DB_ONLY\n" }; };
    const wrongProject = { ...env, DATABASE_URL:
      "postgresql://postgres:synthetic-test@db.another.supabase.co:5432/postgres?sslmode=verify-full" };
    await assert.rejects(verifyNoUnprotectedStorageBinaries(wrongProject, { execute }),
      /PRIVATE_BACKUP_WRONG_PROJECT/);
    await chmod(ca, 0o644);
    await assert.rejects(verifyNoUnprotectedStorageBinaries(env, { execute }),
      /PRIVATE_BACKUP_CA_FILE_INVALID/);
    await chmod(ca, 0o600);
    const noPassword = { ...env, DATABASE_URL:
      "postgresql://postgres@db.urbrtnenrsjvgqjhfhdj.supabase.co:5432/postgres?sslmode=verify-full" };
    await assert.rejects(verifyNoUnprotectedStorageBinaries(noPassword, { execute }),
      /PRIVATE_BACKUP_DATABASE_AUTH_UNAVAILABLE/);
    assert.equal(requests, 0);
  });
});

test("SQL failure rejects without exposing stderr or connection details", async () => {
  await withFixture(async env => {
    const execute = async () => {
      throw Error("postgresql://postgres:highly-confidential@db.internal/postgres");
    };
    await assert.rejects(verifyNoUnprotectedStorageBinaries(env, { execute }), error =>
      error.message === "STORAGE_COVERAGE_DATABASE_INVENTORY_UNAVAILABLE");
  });
});

test("nonempty Storage blocks upload even when credentials and CA are valid", async () => {
  await withFixture(async env => {
    await assert.rejects(verifyNoUnprotectedStorageBinaries(env, {
      execute: async () => ({ stdout: "STORAGE_EXTERNAL_COPY_REQUIRED\n" }),
    }), /STORAGE_COVERAGE_EXTERNAL_FILES_NOT_BACKED_UP/);
  });
});
