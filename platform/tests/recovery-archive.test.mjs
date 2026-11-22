import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat, symlink, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encryptBackupArchive, verifyBackupArchive, decryptBackupArchive } from "../database/recovery-archive.js";

const sha256 = input => createHash("sha256").update(input).digest("hex");
const key = () => randomBytes(32).toString("base64");

async function fixture(action) {
  const dir = await mkdtemp(join(tmpdir(), "fc340-archive-"));
  await chmod(dir, 0o700);
  const source = join(dir, "source.dump");
  const archive = join(dir, "backup.dump.fcenc");
  const restored = join(dir, "recovered.dump");
  const synthetic = randomBytes(1_100_000);
  await writeFile(source, synthetic, { mode: 0o600 });
  await writeFile(`${source}.sha256`, `${sha256(synthetic)}\n`, { mode: 0o600 });
  const common = {
    NODE_ENV: "test", RECOVERY_ARCHIVE_KEY_B64: key(),
    DATABASE_DUMP_PATH: source, RECOVERY_ENCRYPTED_PATH: archive,
    RECOVERY_DECRYPTED_PATH: restored,
  };
  try { await action({ dir, source, archive, restored, synthetic, common }); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

const encryptEnv = common => ({ ...common, RECOVERY_ARCHIVE_APPROVED: "ENCRYPT_OR_VERIFY" });
const decryptEnv = common => ({ ...common, RECOVERY_ARCHIVE_APPROVED: "ISOLATED_DECRYPT" });

test("encrypt, verify and decrypt 1.1 MB synthetic PostgreSQL dump with AEAD and SHA-256", async () => {
  await fixture(async ({ source, archive, restored, synthetic, common }) => {
    const encrypted = await encryptBackupArchive(encryptEnv(common));
    assert.equal(encrypted.status, "ENCRYPTED_LOCAL_ARTIFACT");
    assert.equal(encrypted.artifact, "backup.dump.fcenc");
    const ciphertext = await readFile(archive);
    assert.equal(ciphertext.subarray(0, 8).toString("ascii"), "FCBKUP01");
    assert.ok(ciphertext.length > synthetic.length);
    assert.notDeepEqual(ciphertext.subarray(20, 80), synthetic.subarray(0, 60));
    assert.equal((await readFile(`${archive}.sha256`, "utf8")).trim(), sha256(ciphertext));
    assert.equal((await stat(archive)).mode & 0o077, 0);
    assert.equal((await stat(`${archive}.sha256`)).mode & 0o077, 0);
    assert.equal((await readFile(source)).equals(synthetic), true);
    assert.equal((await verifyBackupArchive(encryptEnv(common))).status, "ENCRYPTED_ARCHIVE_VERIFIED");
    const decrypted = await decryptBackupArchive(decryptEnv(common));
    assert.equal(decrypted.status, "DECRYPTED_TO_ISOLATED_LOCAL_FILE");
    assert.deepEqual(await readFile(restored), synthetic);
    assert.equal((await stat(restored)).mode & 0o077, 0);
    assert.equal((await readFile(`${restored}.sha256`, "utf8")).trim(), sha256(synthetic));
    assert.equal((await stat(`${restored}.sha256`)).mode & 0o077, 0);
    assert.equal(JSON.stringify(encrypted).includes(common.RECOVERY_ARCHIVE_KEY_B64), false);
  });
});

test("wrong key refuses verification/decryption and never publishes plaintext", async () => {
  await fixture(async ({ dir, restored, common }) => {
    await encryptBackupArchive(encryptEnv(common));
    const wrong = { ...common, RECOVERY_ARCHIVE_KEY_B64: key() };
    await assert.rejects(verifyBackupArchive(encryptEnv(wrong)), /RECOVERY_ARCHIVE_AUTHENTICATION_FAILED/);
    await assert.rejects(decryptBackupArchive(decryptEnv(wrong)), /RECOVERY_ARCHIVE_AUTHENTICATION_FAILED/);
    assert.equal((await readdir(dir)).includes("recovered.dump"), false);
    await assert.rejects(stat(restored), /ENOENT/);
  });
});

test("tampered ciphertext is detected before decrypt, never produces plaintext", async () => {
  await fixture(async ({ archive, common, restored }) => {
    await encryptBackupArchive(encryptEnv(common));
    const ciphertext = await readFile(archive);
    const originalChecksum = (await readFile(`${archive}.sha256`, "utf8")).trim();
    ciphertext[30] ^= 0x7f;
    await writeFile(archive, ciphertext);
    assert.notEqual(sha256(ciphertext), originalChecksum);
    await assert.rejects(verifyBackupArchive(encryptEnv(common)), /RECOVERY_ARCHIVE_CHECKSUM_MISMATCH/);
    await assert.rejects(decryptBackupArchive(decryptEnv(common)), /RECOVERY_ARCHIVE_CHECKSUM_MISMATCH/);
    await assert.rejects(stat(restored), /ENOENT/);
  });
});

test("invalid authorization, key or file permissions fail closed", async () => {
  await fixture(async ({ archive, source, common }) => {
    await assert.rejects(encryptBackupArchive(common), /RECOVERY_ARCHIVE_NOT_AUTHORIZED/);
    await assert.rejects(encryptBackupArchive({ ...encryptEnv(common), NODE_ENV: "production" }), /NOT_AUTHORIZED/);
    for (const value of ["", "not-a-key", randomBytes(16).toString("base64")]) {
      await assert.rejects(encryptBackupArchive({ ...encryptEnv(common), RECOVERY_ARCHIVE_KEY_B64: value }), /KEY_UNAVAILABLE/);
    }
    await chmod(source, 0o644);
    await assert.rejects(encryptBackupArchive(encryptEnv(common)), /PRIVATE_FILE_REQUIRED/);
    await chmod(source, 0o600);
    await assert.rejects(stat(archive), /ENOENT/);
  });
});

test("never overwrites archived output or previously restored output", async () => {
  await fixture(async ({ archive, restored, common }) => {
    await encryptBackupArchive(encryptEnv(common));
    await assert.rejects(encryptBackupArchive(encryptEnv(common)), e => e.code === "EEXIST");
    await writeFile(restored, "keep-original", { mode: 0o600 });
    await assert.rejects(decryptBackupArchive(decryptEnv(common)), e => e.code === "EEXIST");
    assert.equal(await readFile(restored, "utf8"), "keep-original");
  });
});

test("refuses symlink dump and mismatched source checksum", async () => {
  await fixture(async ({ dir, source, archive, common }) => {
    const linked = join(dir, "linked.dump");
    await symlink(source, linked);
    await assert.rejects(encryptBackupArchive({ ...encryptEnv(common), DATABASE_DUMP_PATH: linked }), /PRIVATE_FILE_REQUIRED/);
    await writeFile(`${source}.sha256`, `${"0".repeat(64)}\n`);
    await assert.rejects(encryptBackupArchive(encryptEnv(common)), /SOURCE_CHANGED/);
    await assert.rejects(stat(archive), /ENOENT/);
  });
});
