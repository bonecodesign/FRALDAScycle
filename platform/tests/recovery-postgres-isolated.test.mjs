import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  encryptBackupArchive, verifyBackupArchive, decryptBackupArchive,
} from "../database/recovery-archive.js";

// FC-348: a REAL PostgreSQL 17 export -> AES-256-GCM -> decrypt -> restore
// exercise, but ONLY between two new, disposable Docker databases. No network
// ports are published. The dedicated Docker network has no external egress.
// No real Supabase, Dropbox, GitHub Secrets, customer data or production mode.
const approved =
  process.env.FC_ISOLATED_RECOVERY_TEST === "true" &&
  process.env.GITHUB_ACTIONS === "true" &&
  process.env.GITHUB_REPOSITORY === "bonecodesign/FRALDAScycle";

const execute = promisify(execFile);
const image = "postgres:17-alpine";
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

test("isolated PostgreSQL 17 database survives a real encrypted backup and restoration", {
  skip: !approved && "Only the explicitly isolated public CI step may run this test.",
  timeout: 240_000,
}, async () => {
  assert.notEqual(process.env.NODE_ENV, "production");
  for (const key of [
    "DATABASE_URL", "RESTORE_DATABASE_URL", "FC_BR_DATABASE_URL",
    "FC_DB_CA_PEM", "DROPBOX_REFRESH_TOKEN", "FC_BACKUP_ENCRYPTION_KEY_B64",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]) assert.equal(process.env[key], undefined, "external credentials are forbidden in this test");

  const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
  const network = "fc-recovery-ci-net-" + suffix;
  const source = "fc-recovery-ci-src-" + suffix;
  const target = "fc-recovery-ci-dst-" + suffix;
  const folder = await mkdtemp(join(tmpdir(), "fc-real-restore-synthetic-"));
  await chmod(folder, 0o700);
  const original = join(folder, "synthetic.dump");
  const encrypted = original + ".fcenc";
  const restored = join(folder, "restored.dump");
  const dbPassword = randomBytes(32).toString("hex");
  const key = randomBytes(32).toString("base64");
  const dockerEnvironment = {
    PATH: process.env.PATH || "/usr/bin:/bin",
    HOME: process.env.HOME || "/tmp",
    POSTGRES_PASSWORD: dbPassword,
    PGPASSWORD: dbPassword,
  };
  const docker = async (step, ...args) => {
    try {
      return await execute("docker", ["--host=unix:///var/run/docker.sock", ...args], {
        env: dockerEnvironment, encoding: "utf8", timeout: 120_000,
        maxBuffer: 1024 * 1024, windowsHide: true,
      });
    } catch {
      // Avoid emitting Docker connection strings or arbitrary stderr in CI logs.
      throw new Error("FC_ISOLATED_RECOVERY_" + step + "_FAILED");
    }
  };
  const executable = async (step, args) => docker(step, "run", "--rm",
    "--network", network, "--read-only", "--tmpfs", "/tmp:rw,nosuid,noexec,size=32m",
    "--security-opt", "no-new-privileges", "--cap-drop", "ALL",
    "--user", String(process.getuid()) + ":" + String(process.getgid()),
    "--mount", "type=bind,src=" + folder + ",dst=/backup,readonly",
    "--env", "PGPASSWORD", "--env", "PGUSER=postgres",
    "--env", "PGDATABASE=postgres", "--env", "PGSSLMODE=disable",
    "--entrypoint", args[0], image, ...args.slice(1));

  let networkCreated = false;
  const containers = [];
  try {
    await docker("NETWORK_CREATE", "network", "create", "--internal", network);
    networkCreated = true;

    for (const name of [source, target]) {
      await docker("DB_CREATE", "run", "--rm", "-d", "--name", name,
        "--network", network,
        "--tmpfs", "/var/lib/postgresql/data:rw,nosuid,size=256m",
        "--env", "POSTGRES_PASSWORD", image);
      containers.push(name);
      let ready = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        try {
          await docker("DB_READY", "exec", name, "pg_isready", "-q", "-U", "postgres");
          ready = true;
          break;
        } catch { await pause(300); }
      }
      assert.ok(ready, "disposable PostgreSQL 17 did not become ready");
    }

    const seed = "CREATE TABLE public.fc_recovery_ci (id integer PRIMARY KEY, marker text NOT NULL); " +
      "INSERT INTO public.fc_recovery_ci VALUES (1, 'synthetic-original'), (2, 'integrity-check');";
    await docker("SEED", "exec", source, "psql", "-X", "-v", "ON_ERROR_STOP=1",
      "-U", "postgres", "-d", "postgres", "-c", seed);

    await writeFile(original, "", { mode: 0o600, flag: "wx" });
    await docker("DUMP", "run", "--rm", "--network", network,
      "--security-opt", "no-new-privileges", "--cap-drop", "ALL",
      "--user", String(process.getuid()) + ":" + String(process.getgid()),
      "--mount", "type=bind,src=" + folder + ",dst=/backup",
      "--env", "PGPASSWORD", "--env", "PGHOST=" + source,
      "--env", "PGUSER=postgres", "--env", "PGDATABASE=postgres",
      "--env", "PGSSLMODE=disable",
      "--entrypoint", "pg_dump", image,
      "--format=custom", "--compress=9", "--no-owner", "--no-privileges",
      "--file", "/backup/synthetic.dump");

    const dumpStats = await stat(original);
    assert.ok(dumpStats.isFile() && dumpStats.size > 0);
    assert.equal(dumpStats.mode & 0o077, 0);
    const toc = await executable("TOC", ["pg_restore", "--list", "/backup/synthetic.dump"]);
    assert.match(toc.stdout, /\bTABLE public fc_recovery_ci\b/);
    assert.match(toc.stdout, /\bTABLE DATA public fc_recovery_ci\b/);

    const sha = createHash("sha256");
    for await (const chunk of createReadStream(original)) sha.update(chunk);
    const digest = sha.digest("hex");
    await writeFile(original + ".sha256", digest + "\n", { mode: 0o600, flag: "wx" });
    const env = {
      NODE_ENV: "test",
      RECOVERY_ARCHIVE_KEY_B64: key,
      DATABASE_DUMP_PATH: original,
      RECOVERY_ENCRYPTED_PATH: encrypted,
      RECOVERY_DECRYPTED_PATH: restored,
    };
    await encryptBackupArchive({ ...env, RECOVERY_ARCHIVE_APPROVED: "ENCRYPT_OR_VERIFY" });
    assert.equal((await verifyBackupArchive({
      ...env, RECOVERY_ARCHIVE_APPROVED: "ENCRYPT_OR_VERIFY",
    })).status, "ENCRYPTED_ARCHIVE_VERIFIED");
    await rm(original);
    await rm(original + ".sha256");

    const recovered = await decryptBackupArchive({
      ...env, RECOVERY_ARCHIVE_APPROVED: "ISOLATED_DECRYPT",
    });
    assert.equal(recovered.status, "DECRYPTED_TO_ISOLATED_LOCAL_FILE");
    assert.equal((await readFile(restored + ".sha256", "utf8")).trim(), digest);

    const before = await docker("TARGET_PRECHECK", "exec", target, "psql",
      "-X", "-At", "-U", "postgres", "-d", "postgres", "-c",
      "SELECT to_regclass('public.fc_recovery_ci') IS NULL;");
    assert.equal(before.stdout.trim(), "t", "restore target must be empty");

    await docker("RESTORE", "run", "--rm", "--network", network,
      "--security-opt", "no-new-privileges", "--cap-drop", "ALL",
      "--user", String(process.getuid()) + ":" + String(process.getgid()),
      "--mount", "type=bind,src=" + folder + ",dst=/backup,readonly",
      "--env", "PGPASSWORD", "--env", "PGHOST=" + target,
      "--env", "PGUSER=postgres", "--env", "PGDATABASE=postgres",
      "--env", "PGSSLMODE=disable",
      "--entrypoint", "pg_restore", image,
      "--exit-on-error", "--single-transaction", "--no-owner",
      "--no-privileges", "--dbname=postgres", "/backup/restored.dump");

    const result = await docker("VERIFY_ROWS", "exec", target, "psql",
      "-X", "-At", "-U", "postgres", "-d", "postgres", "-c",
      "SELECT id,marker FROM public.fc_recovery_ci ORDER BY id;");
    assert.equal(result.stdout.trim(),
      "1|synthetic-original\n2|integrity-check");
    console.log("FC_ISOLATED_RECOVERY_SUCCEEDED: PG17 -> encrypted archive -> distinct PG17 (synthetic only)");
  } finally {
    const cleanupErrors = [];
    for (const name of containers.reverse()) {
      try { await docker("CLEANUP_CONTAINER", "rm", "-f", name); }
      catch { cleanupErrors.push("container"); }
    }
    if (networkCreated) {
      try { await docker("CLEANUP_NETWORK", "network", "rm", network); }
      catch { cleanupErrors.push("network"); }
    }
    await rm(folder, { recursive: true, force: true });
    assert.deepEqual(cleanupErrors, [], "all disposable Docker resources must be removed");
  }
});
