import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile, chmod, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encryptBackupArchive } from "../database/recovery-archive.js";
import {
  CONTENT_BLOCK_BYTES, DROPBOX_BACKUP_FOLDER, localFileDigests,
  uploadVerifiedArchive, validateBackupProtectionFiles, validateBackupSource,
} from "../tools/dropbox-encrypted-upload.mjs";

const digest = x => createHash("sha256").update(x).digest("hex");
function configured(overrides = {}) {
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: "bonecodesign/fraldacycle-backups-private",
    NODE_ENV: "test",
    PRIVATE_BACKUP_RUNNER_APPROVED: "MANUAL_HOMOLOGATION",
    OFFSITE_BACKUP_UPLOAD_APPROVED: "PRIVATE_RUNNER_MANUAL",
    PGSSLROOTCERT: "/private/ca.crt",
    RECOVERY_ARCHIVE_KEY_B64: randomBytes(32).toString("base64"),
    DATABASE_URL: "postgresql://postgres:synthetic@db.urbrtnenrsjvgqjhfhdj.supabase.co:5432/postgres?sslmode=verify-full",
    DATABASE_DUMP_PATH: "/private/example.dump",
    DROPBOX_APP_KEY: "test-app-key",
    DROPBOX_APP_SECRET: "test-app-secret",
    DROPBOX_REFRESH_TOKEN: "test-refresh-token",
    ...overrides,
  };
}

function fakeDropbox({ corruptContentHash = false, corruptReadback = false, failFinishAt = 0 } = {}) {
  const sessions = new Map();
  const completed = [];
  const requested = [];
  const accessToken = "synthetic-access-token";
  let seq = 0;
  const fetchImpl = async (url, params) => {
    requested.push(url);
    if (url.endsWith("/oauth2/token")) {
      assert.equal(params.body.get("grant_type"), "refresh_token");
      assert.equal(params.body.get("client_secret"), "test-app-secret");
      return new Response(JSON.stringify({ access_token: accessToken }), { status: 200 });
    }
    assert.equal(params.headers.Authorization, `Bearer ${accessToken}`);
    const arg = JSON.parse(params.headers["Dropbox-API-Arg"]);
    if (url.endsWith("/files/download")) {
      const stored = completed.find(item => item.path_display === arg.path);
      assert.ok(stored);
      const remoteBytes = corruptReadback && arg.path.endsWith(".dump.fcenc")
        ? Buffer.concat([stored.remoteBytes, Buffer.from("changed")]) : stored.remoteBytes;
      return new Response(remoteBytes, {
        status: 200,
        headers: { "Dropbox-API-Result": JSON.stringify({
          path_display: stored.path_display,
          content_hash: stored.content_hash,
          size: stored.remoteBytes.length,
        }) },
      });
    }
    if (url.endsWith("/upload_session/start")) {
      const session_id = `synthetic-session-${++seq}`;
      sessions.set(session_id, { chunks: [], closed: false });
      assert.equal(params.body.length, 0);
      return new Response(JSON.stringify({ session_id }), { status: 200 });
    }
    if (url.endsWith("/upload_session/append_v2")) {
      const session = sessions.get(arg.cursor.session_id);
      assert.ok(session);
      assert.equal(session.closed, false);
      assert.equal(session.chunks.reduce((n, c) => n + c.length, 0), arg.cursor.offset);
      session.chunks.push(Buffer.from(params.body));
      if (!arg.close) assert.equal(params.body.length, CONTENT_BLOCK_BYTES);
      if (arg.close) session.closed = true;
      // The official append_v2 endpoint returns 200 with an empty body.
      return new Response(null, { status: 200 });
    }
    if (url.endsWith("/upload_session/finish")) {
      if (failFinishAt && completed.length + 1 === failFinishAt) {
        return new Response(JSON.stringify({ error_summary: "synthetic_failure" }), { status: 503 });
      }
      const session = sessions.get(arg.cursor.session_id);
      assert.ok(session);
      assert.equal(session.closed, true);
      const remoteBytes = Buffer.concat(session.chunks);
      assert.equal(arg.cursor.offset, remoteBytes.length);
      assert.equal(params.body.length, 0);
      assert.equal(arg.commit.mode, "add");
      assert.equal(arg.commit.autorename, false);
      assert.equal(arg.commit.strict_conflict, true);
      const hash = createHash("sha256");
      for (let i = 0; i < remoteBytes.length; i += CONTENT_BLOCK_BYTES) {
        hash.update(createHash("sha256").update(remoteBytes.subarray(i, i + CONTENT_BLOCK_BYTES)).digest());
      }
      const content_hash = corruptContentHash ? "0".repeat(64) : hash.digest("hex");
      const path_display = arg.commit.path;
      completed.push({ path_display, remoteBytes, content_hash });
      return new Response(JSON.stringify({ path_display, content_hash, size: remoteBytes.length }), { status: 200 });
    }
    assert.fail(`Unexpected Dropbox route ${url}`);
  };
  return { fetchImpl, completed, requested };
}

async function archiveFixture(testFn, bytes = 4_300_000) {
  const dir = await mkdtemp(join(tmpdir(), "fc341-offsite-"));
  await chmod(dir, 0o700);
  const source = join(dir, "source.dump");
  const archive = join(dir, "fc-br-9876-1-20261121T230000Z.dump.fcenc");
  const contents = randomBytes(bytes);
  await writeFile(source, contents, { mode: 0o600 });
  await writeFile(`${source}.sha256`, `${digest(contents)}\n`, { mode: 0o600 });
  const env = configured({
    DATABASE_DUMP_PATH: source, RECOVERY_ENCRYPTED_PATH: archive,
  });
  try {
    await encryptBackupArchive({ ...env, RECOVERY_ARCHIVE_APPROVED: "ENCRYPT_OR_VERIFY" });
    await testFn({ env, contents, archive, dir });
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test("only explicit private GitHub-runner approval and exact Supabase BR target pass", () => {
  assert.equal(validateBackupSource(configured()).connectionMode, "direct");
  assert.equal(validateBackupSource(configured({
    DATABASE_URL: "postgresql://postgres.urbrtnenrsjvgqjhfhdj:synthetic@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full",
  })).connectionMode, "session-pooler");
  for (const changed of [
    { GITHUB_ACTIONS: "false" },
    { GITHUB_REPOSITORY: "bonecodesign/FRALDAScycle" },
    { GITHUB_REPOSITORY: "bonecodesign/another-private-repository" },
    { GITHUB_REPOSITORY: "attacker/backup" },
    { NODE_ENV: "production" },
    { PRIVATE_BACKUP_RUNNER_APPROVED: undefined },
    { OFFSITE_BACKUP_UPLOAD_APPROVED: undefined },
    { PGSSLROOTCERT: "" },
    { RECOVERY_ARCHIVE_KEY_B64: "" },
    { RECOVERY_ARCHIVE_KEY_B64: "not-a-32-byte-base64-key" },
    { DATABASE_URL: "postgresql://postgres@db.urbrtnenrsjvgqjhfhdj.supabase.co:5432/postgres?sslmode=verify-full" },
    { DATABASE_URL: "postgresql://postgres:synthetic@db.wrong.supabase.co:5432/postgres?sslmode=verify-full" },
    { DATABASE_URL: "postgresql://postgres:synthetic@db.urbrtnenrsjvgqjhfhdj.supabase.co:6543/postgres?sslmode=verify-full" },
    { DATABASE_URL: "postgresql://postgres:synthetic@db.urbrtnenrsjvgqjhfhdj.supabase.co:5432/postgres?sslmode=prefer" },
  ]) assert.throws(() => validateBackupSource(configured(changed)), /PRIVATE_BACKUP_|verify-full/);
});

test("runner preflight requires a private regular PEM CA file before pg_dump", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fc342-ca-"));
  try {
    const ca = join(dir, "supabase-ca.crt");
    const pem = "-----BEGIN CERTIFICATE-----\nsynthetic-offline-fixture\n-----END CERTIFICATE-----\n";
    await writeFile(ca, pem, { mode: 0o600 });
    assert.equal((await validateBackupProtectionFiles(configured({ PGSSLROOTCERT: ca }))).project,
      "urbrtnenrsjvgqjhfhdj");
    await chmod(ca, 0o644);
    await assert.rejects(validateBackupProtectionFiles(configured({ PGSSLROOTCERT: ca })),
      /PRIVATE_BACKUP_CA_FILE_INVALID/);
    await chmod(ca, 0o600);
    const linked = join(dir, "linked-ca.crt");
    await symlink(ca, linked);
    await assert.rejects(validateBackupProtectionFiles(configured({ PGSSLROOTCERT: linked })),
      /PRIVATE_BACKUP_CA_FILE_INVALID/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("correct Dropbox 4 MiB block content_hash differs from plain SHA-256", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fc341-hash-"));
  try {
    const path = join(dir, "example.bin");
    const data = Buffer.alloc(CONTENT_BLOCK_BYTES + 3, 0x71);
    await writeFile(path, data, { mode: 0o600 });
    const x = await localFileDigests(path);
    const expected = digest(Buffer.concat([
      createHash("sha256").update(data.subarray(0, CONTENT_BLOCK_BYTES)).digest(),
      createHash("sha256").update(data.subarray(CONTENT_BLOCK_BYTES)).digest(),
    ]));
    assert.equal(x.size, data.length);
    assert.equal(x.sha256, digest(data));
    assert.equal(x.contentHash, expected);
    assert.notEqual(x.contentHash, x.sha256);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("complete encrypted-only Dropbox upload validates two remote hashes and redacts secrets", async () => {
  await archiveFixture(async ({ env, contents }) => {
    const api = fakeDropbox();
    const result = await uploadVerifiedArchive(env, { fetchImpl: api.fetchImpl });
    assert.equal(result.status, "ENCRYPTED_OFFSITE_UPLOAD_COMPLETE");
    assert.equal(result.recoveryTestPerformed, false);
    assert.equal(api.completed.length, 2);
    assert.equal(api.completed[1].path_display, result.archivePath);
    assert.ok(result.archivePath.startsWith(`${DROPBOX_BACKUP_FOLDER}/fc-br-`));
    assert.ok(api.completed[0].path_display.endsWith(".dump.fcenc.sha256"));
    assert.equal(api.completed[1].remoteBytes.subarray(0, 8).toString(), "FCBKUP01");
    assert.notDeepEqual(api.completed[1].remoteBytes.subarray(20, 120), contents.subarray(0, 100));
    assert.equal(api.completed[0].remoteBytes.toString().trim(), result.archiveSha256);
    assert.equal(JSON.stringify(result).includes("synthetic"), false);
    assert.equal(JSON.stringify(result).includes(env.RECOVERY_ARCHIVE_KEY_B64), false);
    assert.equal(JSON.stringify(result).includes(env.DATABASE_URL), false);
    assert.equal(JSON.stringify(result).includes("test-refresh-token"), false);
    assert.equal(api.requested.filter(url => url.endsWith("append_v2")).length >= 3, true);
    assert.equal(api.requested.filter(url => url.endsWith("/files/download")).length, 2);
  });
});

test("wrong encryption key prevents any Dropbox network request", async () => {
  await archiveFixture(async ({ env }) => {
    let called = 0;
    const fetchImpl = async () => { called++; throw new Error("unexpected network"); };
    await assert.rejects(uploadVerifiedArchive({
      ...env, RECOVERY_ARCHIVE_KEY_B64: randomBytes(32).toString("base64"),
    }, { fetchImpl }), /RECOVERY_ARCHIVE_AUTHENTICATION_FAILED/);
    assert.equal(called, 0);
  }, 128);
});

test("remote Dropbox content hash mismatch fails closed and never records a complete pair", async () => {
  await archiveFixture(async ({ env }) => {
    const api = fakeDropbox({ corruptContentHash: true });
    await assert.rejects(uploadVerifiedArchive(env, { fetchImpl: api.fetchImpl }), /PRIVATE_BACKUP_REMOTE_HASH_MISMATCH/);
    assert.equal(api.completed.length, 1);
  }, 128);
});

test("downloaded pair is independently rehashed and a changed readback fails closed", async () => {
  await archiveFixture(async ({ env }) => {
    const api = fakeDropbox({ corruptReadback: true });
    await assert.rejects(uploadVerifiedArchive(env, { fetchImpl: api.fetchImpl }),
      /PRIVATE_BACKUP_REMOTE_READBACK_MISMATCH/);
    assert.equal(api.completed.length, 2);
    assert.equal(api.requested.filter(url => url.endsWith("/files/download")).length, 2);
  }, 128);
});

test("second upload failure leaves checksum only and never claims a complete backup", async () => {
  await archiveFixture(async ({ env }) => {
    const api = fakeDropbox({ failFinishAt: 2 });
    await assert.rejects(uploadVerifiedArchive(env, { fetchImpl: api.fetchImpl }),
      /PRIVATE_BACKUP_REMOTE_REQUEST_REJECTED/);
    assert.equal(api.completed.length, 1);
    assert.ok(api.completed[0].path_display.endsWith(".dump.fcenc.sha256"));
    assert.equal(api.requested.some(url => url.endsWith("/files/download")), false);
  }, 128);
});

test("missing Dropbox OAuth credentials are rejected before network", async () => {
  await archiveFixture(async ({ env }) => {
    let calls = 0;
    await assert.rejects(uploadVerifiedArchive({ ...env, DROPBOX_REFRESH_TOKEN: "" }, {
      fetchImpl: async () => { calls++; return new Response(null); },
    }), /PRIVATE_BACKUP_DROPBOX_AUTH_MISSING/);
    assert.equal(calls, 0);
  }, 128);
});
