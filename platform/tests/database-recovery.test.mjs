import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { chmod, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { createBackupPlan, createRestorePlan, executeBackupPlan, executePlan, executeRestorePlan } from "../database/recovery.js";

test("backup uses custom compressed format without exposing credentials in arguments", () => {
  const plan = createBackupPlan({
    DATABASE_URL: "postgresql://operator:secret@db.internal:5433/fraldacycle?sslmode=require",
    DATABASE_DUMP_PATH: "./backups/fraldacycle.dump",
  });
  assert.equal(plan.command, "pg_dump");
  assert.ok(plan.args.includes("--format=custom"));
  assert.equal(plan.args.join(" ").includes("secret"), false);
  assert.equal(plan.env.PGPASSWORD, "secret");
  assert.equal(plan.env.PGSSLMODE, "require");
});

test("restore requires explicit authorization and targets a separate database", () => {
  assert.throws(() => createRestorePlan({
    RESTORE_DATABASE_URL: "postgresql://operator:secret@db.internal/restore",
    DATABASE_DUMP_PATH: "./backup.dump",
  }), /authorize restoration/);
  const plan = createRestorePlan({
    CONFIRM_DATABASE_RESTORE: "RESTORE",
    RESTORE_DATABASE_URL: "postgresql://operator:secret@db.internal/restore",
    DATABASE_DUMP_PATH: "./backup.dump",
  });
  assert.equal(plan.command, "pg_restore");
  assert.ok(plan.args.includes("--exit-on-error"));
  assert.ok(plan.args.includes("--single-transaction"));
  assert.ok(plan.args.includes("restore"));
  assert.equal(plan.args.join(" ").includes("secret"), false);
});

test("restore refuses to overwrite the configured source database", () => {
  assert.throws(() => createRestorePlan({
    CONFIRM_DATABASE_RESTORE: "RESTORE",
    DATABASE_URL: "postgresql://source:one@db.internal:5432/fraldacycle",
    RESTORE_DATABASE_URL: "postgresql://restore:two@db.internal/fraldacycle",
    DATABASE_DUMP_PATH: "./backup.dump",
  }), /different from DATABASE_URL/);
});

test("restore recognizes canonical DNS and loopback spellings of the source endpoint", () => {
  const sameEndpoint = [
    ["postgresql://source:one@DB.INTERNAL:5432/fraldacycle", "postgresql://restore:two@db.internal./fraldacycle"],
    ["postgresql://source:one@localhost/fraldacycle", "postgresql://restore:two@127.0.0.1:5432/fraldacycle"],
    ["postgresql://source:one@[::1]:5432/fraldacycle", "postgresql://restore:two@localhost/fraldacycle"],
  ];
  for (const [DATABASE_URL, RESTORE_DATABASE_URL] of sameEndpoint) {
    assert.throws(() => createRestorePlan({
      CONFIRM_DATABASE_RESTORE: "RESTORE", DATABASE_URL, RESTORE_DATABASE_URL,
      DATABASE_DUMP_PATH: "./backup.dump",
    }), /different from DATABASE_URL/);
  }
});

test("backup and restore require a valid PostgreSQL database address", () => {
  assert.throws(() => createBackupPlan({
    DATABASE_URL: "not-a-url", DATABASE_DUMP_PATH: "./backup.dump",
  }), /invalid/);
  assert.throws(() => createBackupPlan({
    DATABASE_URL: "postgresql://db.internal", DATABASE_DUMP_PATH: "./backup.dump",
  }), /database name/);
  assert.throws(() => createBackupPlan({
    DATABASE_URL: "postgresql://db.internal/backup", DATABASE_DUMP_PATH: "./backup.dump",
  }), /username/);
  for (const port of ["0", "65536"]) {
    assert.throws(() => createBackupPlan({
      DATABASE_URL: `postgresql://user:pass@db.internal:${port}/backup`, DATABASE_DUMP_PATH: "./backup.dump",
    }), /port is invalid|Database URL is invalid/);
  }
});

test("database URLs reject ignored options and normalize encoded database names and IPv6 hosts", () => {
  const plan = createBackupPlan({
    DATABASE_URL: "postgresql://user:pass@[::1]:5433/fralda%20cycle?sslmode=verify-full",
    DATABASE_DUMP_PATH: "./backup.dump",
  });
  assert.equal(plan.env.PGHOST, "::1");
  assert.equal(plan.env.PGPORT, "5433");
  assert.equal(plan.env.PGDATABASE, "fralda cycle");
  assert.equal(plan.env.PGSSLMODE, "verify-full");

  for (const query of ["host=prod", "port=5432", "dbname=other", "user=other", "sslrootcert=./ca.pem", "sslmode=prefer&sslmode=require", "sslmode=unknown", "sslmode="]) {
    assert.throws(() => createBackupPlan({
      DATABASE_URL: `postgresql://user:pass@db.internal/db?${query}`,
      DATABASE_DUMP_PATH: "./backup.dump",
    }), /unsupported parameter|at most one sslmode|sslmode is invalid/);
  }
});

test("database URLs reject malformed encoded components and fragments", () => {
  for (const DATABASE_URL of [
    "postgresql://user:pass@db.internal/db%ZZ",
    "postgresql://user:pass@db.internal/db#production",
  ]) assert.throws(() => createBackupPlan({ DATABASE_URL, DATABASE_DUMP_PATH: "./backup.dump" }));
});

test("database utilities receive parsed PG settings but not raw database URLs", async () => {
  const plan = createRestorePlan({
    CONFIRM_DATABASE_RESTORE: "RESTORE",
    DATABASE_URL: "postgresql://source:source-secret@source.example.test/source",
    RESTORE_DATABASE_URL: "postgresql://restore:restore-secret@restore.example.test/restore",
    DATABASE_DUMP_PATH: "./backup.dump",
  });
  const child = new EventEmitter();
  const result = executePlan(plan, {
    parentEnv: {
      PATH: "/bin", DATABASE_URL: "source-url-secret", RESTORE_DATABASE_URL: "restore-url-secret",
      PGHOSTADDR: "source-ip", PGSERVICE: "production", PGSSLMODE: "disable", PGSSLROOTCERT: "/certs/root.pem",
    },
    spawnImpl: (_command, _args, options) => {
      assert.equal(options.env.DATABASE_URL, undefined);
      assert.equal(options.env.RESTORE_DATABASE_URL, undefined);
      assert.equal(options.env.PGHOSTADDR, undefined);
      assert.equal(options.env.PGSERVICE, undefined);
      assert.equal(options.env.PGSSLMODE, undefined);
      assert.equal(options.env.PGSSLROOTCERT, "/certs/root.pem");
      assert.equal(options.env.PGPASSWORD, "restore-secret");
      assert.equal(options.env.PGHOST, "restore.example.test");
      queueMicrotask(() => child.emit("exit", 0));
      return child;
    },
  });
  await result;
});

test("backup publishes a private dump atomically and never overwrites an existing destination", async () => {
  const root = await mkdtemp(join(tmpdir(), "fraldacycle-recovery-"));
  try {
    const destination = join(root, "safe.dump");
    const plan = createBackupPlan({ DATABASE_URL: "postgresql://user:pass@localhost/db", DATABASE_DUMP_PATH: destination });
    const spawnImpl = (command, args, options) => {
      assert.equal(command, "pg_dump");
      assert.equal(options.umask, 0o077);
      const output = args[args.indexOf("--file") + 1];
      assert.notEqual(output, destination);
      requireWrite(output);
      const child = new EventEmitter();
      queueMicrotask(() => child.emit("exit", 0));
      return child;
    };
    await executeBackupPlan(plan, { spawnImpl });
    assert.equal((await readFile(destination, "utf8")), "synthetic dump");
    assert.equal((await stat(destination)).mode & 0o077, 0);
    assert.match(await readFile(`${destination}.sha256`, "utf8"), /^[a-f0-9]{64}\n$/);
    assert.equal((await stat(`${destination}.sha256`)).mode & 0o077, 0);
    assert.deepEqual((await readdir(root)).sort(), ["safe.dump", "safe.dump.sha256"]);

    await writeFile(destination, "preserve this backup");
    await assert.rejects(executeBackupPlan(plan, { spawnImpl }), error => error.code === "EEXIST");
    assert.equal(await readFile(destination, "utf8"), "preserve this backup");
    assert.deepEqual((await readdir(root)).sort(), ["safe.dump", "safe.dump.sha256"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("failed backup leaves no published or temporary dump", async () => {
  const root = await mkdtemp(join(tmpdir(), "fraldacycle-recovery-failure-"));
  try {
    const destination = join(root, "failed.dump");
    const plan = createBackupPlan({ DATABASE_URL: "postgresql://user:pass@localhost/db", DATABASE_DUMP_PATH: destination });
    const spawnImpl = (_command, args) => {
      requireWrite(args[args.indexOf("--file") + 1]);
      const child = new EventEmitter();
      queueMicrotask(() => child.emit("exit", 1));
      return child;
    };
    await assert.rejects(executeBackupPlan(plan, { spawnImpl }), /failed with exit code 1/);
    assert.deepEqual(await readdir(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("restore accepts only a present non-empty private regular dump before spawning pg_restore", async () => {
  const root = await mkdtemp(join(tmpdir(), "fraldacycle-restore-"));
  try {
    const dump = join(root, "restore.dump");
    const plan = createRestorePlan({ CONFIRM_DATABASE_RESTORE: "RESTORE", RESTORE_DATABASE_URL: "postgresql://user:pass@localhost/restore", DATABASE_DUMP_PATH: dump });
    let calls = 0;
    const spawnImpl = (command, _args, options) => {
      calls++;
      assert.equal(command, "pg_restore");
      assert.equal(options.umask, 0o077);
      const child = new EventEmitter();
      queueMicrotask(() => child.emit("exit", 0));
      return child;
    };

    await assert.rejects(executeRestorePlan(plan, { spawnImpl }), /unavailable/);
    await writeFile(dump, "");
    await assert.rejects(executeRestorePlan(plan, { spawnImpl }), /non-empty private regular file/);
    await writeFile(dump, "synthetic dump");
    await chmod(dump, 0o644);
    await assert.rejects(executeRestorePlan(plan, { spawnImpl }), /non-empty private regular file/);
    await chmod(dump, 0o600);
    await writeChecksum(dump);
    await executeRestorePlan(plan, { spawnImpl });
    assert.equal(calls, 1);
    await writeFile(dump, "tampered dump", { mode: 0o600 });
    await assert.rejects(executeRestorePlan(plan, { spawnImpl }), /checksum mismatch/);
    assert.equal(calls, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("restore refuses symlinked dumps without contacting pg_restore", async () => {
  const root = await mkdtemp(join(tmpdir(), "fraldacycle-restore-link-"));
  try {
    const target = join(root, "actual.dump"), alias = join(root, "linked.dump");
    await writeFile(target, "synthetic dump", { mode: 0o600 });
    await symlink(target, alias);
    const plan = createRestorePlan({ CONFIRM_DATABASE_RESTORE: "RESTORE", RESTORE_DATABASE_URL: "postgresql://user:pass@localhost/restore", DATABASE_DUMP_PATH: alias });
    await assert.rejects(executeRestorePlan(plan, { spawnImpl: () => assert.fail("pg_restore must not start") }), /private regular file/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

function requireWrite(path) {
  // Simulate pg_dump creating its output, while retaining the child process contract.
  writeFileSync(path, "synthetic dump", { mode: 0o600 });
}

async function writeChecksum(path) {
  const content = await readFile(path);
  const digest = createHash("sha256").update(content).digest("hex");
  await writeFile(`${path}.sha256`, `${digest}\n`, { mode: 0o600 });
}
