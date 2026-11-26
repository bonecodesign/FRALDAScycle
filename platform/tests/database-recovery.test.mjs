import assert from "node:assert/strict";
import test from "node:test";
import { statSync, writeFileSync } from "node:fs";
import { chmod, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { createBackupPlan, createRestorePlan, executeBackupPlan, executePlan, executeRestorePlan } from "../database/recovery.js";

test("backup uses custom compressed format without exposing credentials in arguments", () => {
  const plan = createBackupPlan({
    DATABASE_URL: "postgresql://operator:secret@db.internal:5433/fraldacycle?sslmode=verify-full",
    DATABASE_DUMP_PATH: "./backups/fraldacycle.dump",
  });
  assert.equal(plan.command, "pg_dump");
  assert.ok(plan.args.includes("--format=custom"));
  assert.equal(plan.args.join(" ").includes("secret"), false);
  assert.equal(plan.env.PGPASSWORD, "secret");
  assert.equal(plan.env.PGSSLMODE, "verify-full");
});

test("restore requires explicit authorization and targets a separate database", () => {
  assert.throws(() => createRestorePlan({
    RESTORE_DATABASE_URL: "postgresql://operator:secret@db.internal/restore",
    DATABASE_DUMP_PATH: "./backup.dump",
  }), /authorize restoration/);
  const plan = createRestorePlan({
    CONFIRM_DATABASE_RESTORE: "RESTORE",
    CONFIRM_REMOTE_RESTORE_TARGET: "db.internal:5432/restore",
    RESTORE_DATABASE_URL: "postgresql://operator:secret@db.internal/restore?sslmode=verify-full",
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

test("remote restore requires exact secret-free target identity, not a generic acknowledgement", () => {
  const base = {
    CONFIRM_DATABASE_RESTORE: "RESTORE",
    DATABASE_URL: "postgresql://source:sensitive@db.source.example.test/postgres",
    RESTORE_DATABASE_URL: "postgresql://restore:othersecret@db.target.example.test:5432/recovery?sslmode=verify-full",
    DATABASE_DUMP_PATH: "./isolated.dump",
  };
  assert.throws(() => createRestorePlan(base), /CONFIRM_REMOTE_RESTORE_TARGET/);
  assert.throws(() => createRestorePlan({
    ...base, CONFIRM_REMOTE_RESTORE_TARGET: "db.source.example.test:5432/postgres",
  }), /CONFIRM_REMOTE_RESTORE_TARGET/);
  assert.throws(() => createRestorePlan({
    ...base, CONFIRM_REMOTE_RESTORE_TARGET: "db.target.example.test:5432/postgres",
  }), /CONFIRM_REMOTE_RESTORE_TARGET/);
  const plan = createRestorePlan({
    ...base, CONFIRM_REMOTE_RESTORE_TARGET: "db.target.example.test:5432/recovery",
  });
  assert.equal(plan.command, "pg_restore");
  assert.equal(plan.args.join(" ").includes("othersecret"), false);
  assert.equal(plan.env.PGPASSWORD, "othersecret");
});

test("Supabase-hosted restore requires explicit destination identity and never grants implicit approval", () => {
  const base = {
    CONFIRM_DATABASE_RESTORE: "RESTORE",
    DATABASE_DUMP_PATH: "./isolated.dump",
    RESTORE_DATABASE_URL: "postgresql://postgres:sensitive@db.urbrtnenrsjvgqjhfhdj.supabase.co:5432/postgres?sslmode=verify-full",
  };
  assert.throws(() => createRestorePlan(base), /CONFIRM_REMOTE_RESTORE_TARGET/);
  assert.throws(() => createRestorePlan({
    ...base, CONFIRM_REMOTE_RESTORE_TARGET: "localhost:5432/postgres",
  }), /CONFIRM_REMOTE_RESTORE_TARGET/);
});

test("remote pg_dump fails closed without certificate and hostname verification", () => {
  const base = "postgresql://backup:secret@db.urbrtnenrsjvgqjhfhdj.supabase.co:5432/postgres";
  for (const suffix of ["", "?sslmode=disable", "?sslmode=allow", "?sslmode=prefer",
    "?sslmode=require", "?sslmode=verify-ca"]) {
    assert.throws(() => createBackupPlan({
      DATABASE_URL: base + suffix, DATABASE_DUMP_PATH: "./isolated.dump",
    }), error => /sslmode=verify-full/.test(error.message) && !error.message.includes("secret"));
  }
  const secure = createBackupPlan({
    DATABASE_URL: base + "?sslmode=verify-full", DATABASE_DUMP_PATH: "./isolated.dump",
  });
  assert.equal(secure.env.PGSSLMODE, "verify-full");
  assert.equal(secure.env.PGHOST, "db.urbrtnenrsjvgqjhfhdj.supabase.co");
});

test("remote pg_restore rejects weak TLS even after exact destination confirmation", () => {
  const base = {
    CONFIRM_DATABASE_RESTORE: "RESTORE",
    CONFIRM_REMOTE_RESTORE_TARGET: "isolated.example.test:5432/restore",
    DATABASE_DUMP_PATH: "./isolated.dump",
  };
  const url = "postgresql://operator:super-secret@isolated.example.test/restore";
  for (const suffix of ["", "?sslmode=disable", "?sslmode=require", "?sslmode=verify-ca"]) {
    assert.throws(() => createRestorePlan({
      ...base, RESTORE_DATABASE_URL: url + suffix,
    }), error => /sslmode=verify-full/.test(error.message) && !error.message.includes("super-secret"));
  }
  const secure = createRestorePlan({
    ...base, RESTORE_DATABASE_URL: url + "?sslmode=verify-full",
  });
  assert.equal(secure.env.PGSSLMODE, "verify-full");
  assert.equal(secure.command, "pg_restore");
});

test("disposable loopback recovery retains existing no-TLS PostgreSQL workflow", () => {
  const dump = createBackupPlan({
    DATABASE_URL: "postgresql://local@127.0.0.1:5444/postgres",
    DATABASE_DUMP_PATH: "./synthetic.dump",
  });
  assert.equal(dump.env.PGSSLMODE, undefined);
  const restore = createRestorePlan({
    RESTORE_DATABASE_URL: "postgresql://local@localhost:5444/restore",
    CONFIRM_DATABASE_RESTORE: "RESTORE", DATABASE_DUMP_PATH: "./synthetic.dump",
  });
  assert.equal(restore.env.PGSSLMODE, undefined);
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

test("FC-437: recovery rejects database paths that libpq could reinterpret as connection parameters", () => {
  for (const database of ["host=other.example.test dbname=other", "postgresql://other.example.test/other", "postgres://other.example.test/other", "db\0name", "db\nname"]) {
    const url = `postgresql://operator:synthetic-secret@localhost/${encodeURIComponent(database)}`;
    const safeError = error => /literal database name/.test(error.message) && !error.message.includes("synthetic-secret");
    assert.throws(() => createBackupPlan({ DATABASE_URL: url, DATABASE_DUMP_PATH: "./synthetic.dump" }), safeError);
    assert.throws(() => createRestorePlan({
      CONFIRM_DATABASE_RESTORE: "RESTORE",
      RESTORE_DATABASE_URL: url,
      DATABASE_DUMP_PATH: "./synthetic.dump",
    }), safeError);
  }
  const plan = createRestorePlan({
    CONFIRM_DATABASE_RESTORE: "RESTORE",
    RESTORE_DATABASE_URL: "postgresql://operator@localhost/fralda%20cycle",
    DATABASE_DUMP_PATH: "./synthetic.dump",
  });
  assert.equal(plan.env.PGDATABASE, "fralda cycle");
  assert.equal(plan.args[plan.args.indexOf("--dbname") + 1], "fralda cycle");
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
    CONFIRM_REMOTE_RESTORE_TARGET: "restore.example.test:5432/restore",
    DATABASE_URL: "postgresql://source:source-secret@source.example.test/source",
    RESTORE_DATABASE_URL: "postgresql://restore:restore-secret@restore.example.test/restore?sslmode=verify-full",
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
      // Child must keep verify-full from the approved URL, not inherit a disabled mode.
      assert.equal(options.env.PGSSLMODE, "verify-full");
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
      assert.equal(statSync(output).mode & 0o777, 0o600);
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


test("PostgreSQL subprocess timeout kills the child and rejects without success", async () => {
  const child = new EventEmitter();
  let killedWith;
  child.kill = signal => { killedWith = signal; queueMicrotask(() => child.emit("exit", null)); return true; };
  await assert.rejects(
    executePlan({ command: "pg_dump", args: [], env: {} }, {
      timeoutMs: 10,
      parentEnv: {},
      spawnImpl: () => child,
    }),
    /pg_dump timed out after 10 ms/,
  );
  assert.equal(killedWith, "SIGKILL");
});

test("PostgreSQL subprocess timeout is validated and does not kill successful commands", async () => {
  const child = new EventEmitter();
  child.kill = () => assert.fail("A completed subprocess must not be killed");
  assert.throws(() => executePlan({ command: "pg_restore", args: [], env: {} }, {
    timeoutMs: 0,
    spawnImpl: () => assert.fail("Invalid timeout must not spawn"),
  }), /positive integer/);
  await executePlan({ command: "pg_restore", args: [], env: {} }, {
    timeoutMs: 100,
    parentEnv: {},
    spawnImpl: () => { queueMicrotask(() => child.emit("exit", 0)); return child; },
  });
});
