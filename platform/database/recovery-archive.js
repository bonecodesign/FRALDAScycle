import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { appendFile, chmod, link, lstat, mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { isMainModule } from "../packages/contracts/main-module.js";

// Format: eight ASCII magic bytes + 12-byte random IV + encrypted pg_dump + 16-byte GCM tag.
// Only encrypted archives (never plaintext dumps, passwords or encryption keys) may be uploaded.
const MAGIC = Buffer.from("FCBKUP01", "ascii");
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + IV_BYTES;
const CIPHER = "aes-256-gcm";

function fail(code) { return new Error(`RECOVERY_ARCHIVE_${code}`); }

function keyFromEnvironment(env) {
  const value = env.RECOVERY_ARCHIVE_KEY_B64;
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(value)) {
    throw fail("KEY_UNAVAILABLE");
  }
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) {
    throw fail("KEY_UNAVAILABLE");
  }
  return key;
}

function requireApproval(env, mode) {
  if (env.NODE_ENV === "production" || env.RECOVERY_ARCHIVE_APPROVED !==
    (mode === "decrypt" ? "ISOLATED_DECRYPT" : "ENCRYPT_OR_VERIFY")) {
    throw fail("NOT_AUTHORIZED");
  }
}

function pathFromEnvironment(value, suffix) {
  if (typeof value !== "string" || !value.trim() || !value.endsWith(suffix)) {
    throw fail("PATH_INVALID");
  }
  return resolve(value);
}

async function requirePrivateFile(path, minimumBytes = 1) {
  let meta;
  try { meta = await lstat(path); } catch { throw fail("FILE_UNAVAILABLE"); }
  if (!meta.isFile() || meta.size < minimumBytes || (meta.mode & 0o077) !== 0) {
    throw fail("PRIVATE_FILE_REQUIRED");
  }
  return meta;
}

async function checksumFor(path) {
  const sidecar = `${path}.sha256`;
  await requirePrivateFile(sidecar);
  const checksum = await readFile(sidecar, "utf8");
  if (!/^[a-f0-9]{64}\n?$/.test(checksum)) throw fail("CHECKSUM_INVALID");
  return checksum.trim();
}

async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function digestMatches(left, right) {
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

async function temporaryDirectory(path) {
  const directory = await mkdtemp(`${dirname(path)}/.${basename(path)}.tmp-`);
  await chmod(directory, 0o700);
  return directory;
}

async function publishWithChecksum(temporary, destination) {
  const digest = await sha256File(temporary);
  const sidecar = `${temporary}.sha256`;
  await writeFile(sidecar, `${digest}\n`, { flag: "wx", mode: 0o600 });
  // Hard links publish atomically with no overwrite, even if another writer races us.
  await link(temporary, destination);
  try {
    await link(sidecar, `${destination}.sha256`);
  } catch (error) {
    await rm(destination, { force: true });
    throw error;
  }
  return Object.freeze({ sha256: digest, artifact: basename(destination) });
}

export async function encryptBackupArchive(env = process.env) {
  requireApproval(env, "encrypt");
  const input = pathFromEnvironment(env.DATABASE_DUMP_PATH, ".dump");
  const destination = pathFromEnvironment(env.RECOVERY_ENCRYPTED_PATH, ".dump.fcenc");
  if (input === destination || dirname(input) === destination) throw fail("PATH_INVALID");
  await requirePrivateFile(input);
  const expected = await checksumFor(input);
  const key = keyFromEnvironment(env);
  let directory;
  try {
    directory = await temporaryDirectory(destination);
    const intermediate = `${directory}/${basename(destination)}`;
    const iv = randomBytes(IV_BYTES);
    const header = Buffer.concat([MAGIC, iv]);
    const cipher = createCipheriv(CIPHER, key, iv);
    cipher.setAAD(header);
    const inputHash = createHash("sha256");
    const streamHash = new Transform({
      transform(chunk, _encoding, callback) {
        inputHash.update(chunk);
        callback(null, chunk);
      },
    });
    const output = createWriteStream(intermediate, { flags: "wx", mode: 0o600 });
    output.write(header);
    await pipeline(createReadStream(input), streamHash, cipher, output);
    if (!digestMatches(inputHash.digest("hex"), expected)) throw fail("SOURCE_CHANGED");
    await appendFile(intermediate, cipher.getAuthTag());
    const proof = await publishWithChecksum(intermediate, destination);
    return Object.freeze({ status: "ENCRYPTED_LOCAL_ARTIFACT", ...proof });
  } finally {
    key.fill(0);
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}

async function readEnvelope(path, fileSize) {
  const file = await open(path, "r");
  try {
    const header = Buffer.alloc(HEADER_BYTES);
    const tag = Buffer.alloc(TAG_BYTES);
    const first = await file.read(header, 0, HEADER_BYTES, 0);
    const last = await file.read(tag, 0, TAG_BYTES, fileSize - TAG_BYTES);
    if (first.bytesRead !== HEADER_BYTES || last.bytesRead !== TAG_BYTES ||
        !header.subarray(0, MAGIC.length).equals(MAGIC)) {
      throw fail("FORMAT_INVALID");
    }
    return { header, tag };
  } finally { await file.close(); }
}

async function authenticateArchive(path, key, { output = null } = {}) {
  const metadata = await requirePrivateFile(path, HEADER_BYTES + TAG_BYTES + 1);
  const expected = await checksumFor(path);
  if (!digestMatches(await sha256File(path), expected)) throw fail("CHECKSUM_MISMATCH");
  const { header, tag } = await readEnvelope(path, metadata.size);
  const decipher = createDecipheriv(CIPHER, key, header.subarray(MAGIC.length));
  decipher.setAAD(header);
  decipher.setAuthTag(tag);
  const sink = output ?? new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  try {
    await pipeline(createReadStream(path, { start: HEADER_BYTES, end: metadata.size - TAG_BYTES - 1 }),
      decipher, sink);
  } catch {
    throw fail("AUTHENTICATION_FAILED");
  }
  return expected;
}

export async function verifyBackupArchive(env = process.env) {
  requireApproval(env, "verify");
  const archive = pathFromEnvironment(env.RECOVERY_ENCRYPTED_PATH, ".dump.fcenc");
  const key = keyFromEnvironment(env);
  try {
    const digest = await authenticateArchive(archive, key);
    return Object.freeze({ status: "ENCRYPTED_ARCHIVE_VERIFIED", sha256: digest, artifact: basename(archive) });
  } finally { key.fill(0); }
}

export async function decryptBackupArchive(env = process.env) {
  requireApproval(env, "decrypt");
  const archive = pathFromEnvironment(env.RECOVERY_ENCRYPTED_PATH, ".dump.fcenc");
  const destination = pathFromEnvironment(env.RECOVERY_DECRYPTED_PATH, ".dump");
  if (archive === destination) throw fail("PATH_INVALID");
  const key = keyFromEnvironment(env);
  let directory;
  try {
    directory = await temporaryDirectory(destination);
    const temporary = `${directory}/${basename(destination)}`;
    await authenticateArchive(archive, key, {
      output: createWriteStream(temporary, { flags: "wx", mode: 0o600 }),
    });
    // The authenticated plaintext becomes visible only after GCM final() succeeds.
    const proof = await publishWithChecksum(temporary, destination);
    return Object.freeze({ status: "DECRYPTED_TO_ISOLATED_LOCAL_FILE", ...proof });
  } finally {
    key.fill(0);
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}

if (isMainModule(import.meta.url)) {
  const operation = process.argv[2];
  const runner = operation === "encrypt" ? encryptBackupArchive
    : operation === "verify" ? verifyBackupArchive
    : operation === "decrypt" ? decryptBackupArchive : null;
  if (!runner) {
    console.error("Usage: node database/recovery-archive.js <encrypt|verify|decrypt>");
    process.exitCode = 2;
  } else {
    runner().then(result => console.log(JSON.stringify(result)))
      .catch(() => { console.error("RECOVERY_ARCHIVE_OPERATION_FAILED"); process.exitCode = 1; });
  }
}
