import { createHash, timingSafeEqual } from "node:crypto";
import { open, lstat, readFile } from "node:fs/promises";
import { basename } from "node:path";
import { isMainModule } from "../packages/contracts/main-module.js";
import { createBackupPlan } from "../database/recovery.js";
import { verifyBackupArchive } from "../database/recovery-archive.js";

export const DROPBOX_BACKUP_FOLDER = "/FRALDA/Backups-Supabase-BR";
export const FRALDACYCLE_PROJECT_REF = "urbrtnenrsjvgqjhfhdj";
export const CONTENT_BLOCK_BYTES = 4 * 1024 * 1024;

function failure(reason) { return new Error(`PRIVATE_BACKUP_${reason}`); }

function required(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateBackupSource(env) {
  if (env.GITHUB_ACTIONS !== "true" ||
      env.GITHUB_REPOSITORY === "bonecodesign/FRALDAScycle" ||
      !/^bonecodesign\/[A-Za-z0-9_.-]+$/.test(env.GITHUB_REPOSITORY || "") ||
      env.NODE_ENV === "production" ||
      env.PRIVATE_BACKUP_RUNNER_APPROVED !== "MANUAL_HOMOLOGATION" ||
      env.OFFSITE_BACKUP_UPLOAD_APPROVED !== "PRIVATE_RUNNER_MANUAL") {
    throw failure("NOT_AUTHORIZED");
  }
  // Reuse the established libpq verification guard, not a second parser.
  const plan = createBackupPlan(env);
  const host = plan.env.PGHOST.toLowerCase().replace(/\.$/, "");
  const user = plan.env.PGUSER;
  const direct = host === `db.${FRALDACYCLE_PROJECT_REF}.supabase.co` &&
    user === "postgres";
  const session = host.endsWith(".pooler.supabase.com") &&
    user === `postgres.${FRALDACYCLE_PROJECT_REF}`;
  if (!direct && !session) throw failure("WRONG_PROJECT");
  if (plan.env.PGPORT !== "5432" ||
      plan.env.PGDATABASE !== "postgres" ||
      plan.env.PGSSLMODE !== "verify-full") {
    throw failure("TRANSPORT_REJECTED");
  }
  if (!required(env.PGSSLROOTCERT) || !required(env.RECOVERY_ARCHIVE_KEY_B64)) {
    throw failure("PROTECTION_UNAVAILABLE");
  }
  // The CA is a file path, not a certificate pasted into the process command line.
  return Object.freeze({ project: FRALDACYCLE_PROJECT_REF, connectionMode: direct ? "direct" : "session-pooler" });
}

function validateArchivePath(path) {
  if (!required(path) || !/\.dump\.fcenc$/.test(path)) throw failure("ARCHIVE_PATH");
  const fileName = basename(path);
  if (!/^fc-br-[a-zA-Z0-9_-]+\.dump\.fcenc$/.test(fileName) ||
      fileName.length > 180) throw failure("ARCHIVE_NAME");
  return fileName;
}

async function privateRegularFile(path) {
  let meta;
  try { meta = await lstat(path); } catch { throw failure("FILE_MISSING"); }
  if (!meta.isFile() || meta.size <= 0 || (meta.mode & 0o077) !== 0) {
    throw failure("PRIVATE_FILE_REQUIRED");
  }
  return meta;
}

function checkDigest(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) throw failure("INVALID_HASH");
  return value;
}

function matchesDigest(first, second) {
  return timingSafeEqual(Buffer.from(checkDigest(first), "hex"), Buffer.from(checkDigest(second), "hex"));
}

// Dropbox content_hash: SHA-256 of concatenated SHA-256 hashes of successive 4 MiB blocks.
// This is NOT the SHA-256 of the whole file; both checks are required.
export async function localFileDigests(path) {
  const file = await open(path, "r");
  const fileHash = createHash("sha256");
  const dropboxHash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(CONTENT_BLOCK_BYTES);
  let bytes = 0;
  try {
    while (true) {
      // Consume complete 4 MiB blocks regardless of OS-level partial reads.
      let filled = 0;
      while (filled < buffer.length) {
        const { bytesRead } = await file.read(buffer, filled, buffer.length - filled, null);
        if (bytesRead === 0) break;
        filled += bytesRead;
      }
      if (filled === 0) break;
      const block = buffer.subarray(0, filled);
      fileHash.update(block);
      dropboxHash.update(createHash("sha256").update(block).digest());
      bytes += filled;
      if (filled < buffer.length) break;
    }
  } finally { await file.close(); }
  return Object.freeze({ sha256: fileHash.digest("hex"), contentHash: dropboxHash.digest("hex"), size: bytes });
}

async function apiJson(url, { method = "POST", headers = {}, body = undefined } = {}, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(url, { method, headers, body, signal: AbortSignal.timeout(120_000) });
  } catch {
    throw failure("REMOTE_REQUEST_FAILED");
  }
  if (!response.ok) throw failure("REMOTE_REQUEST_REJECTED");
  try {
    const bodyText = await response.text();
    return bodyText ? JSON.parse(bodyText) : {};
  } catch { throw failure("REMOTE_RESPONSE_INVALID"); }
}

async function dropboxAccessToken(env, fetchImpl) {
  for (const name of ["DROPBOX_APP_KEY", "DROPBOX_APP_SECRET", "DROPBOX_REFRESH_TOKEN"]) {
    if (!required(env[name])) throw failure("DROPBOX_AUTH_MISSING");
  }
  const tokenResponse = await apiJson("https://api.dropboxapi.com/oauth2/token", {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: env.DROPBOX_REFRESH_TOKEN,
      client_id: env.DROPBOX_APP_KEY,
      client_secret: env.DROPBOX_APP_SECRET,
    }),
  }, fetchImpl);
  if (!required(tokenResponse.access_token)) throw failure("DROPBOX_AUTH_FAILED");
  return tokenResponse.access_token;
}

function uploadHeaders(token, argument) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/octet-stream",
    "Dropbox-API-Arg": JSON.stringify(argument),
  };
}

async function contentRequest(operation, token, argument, bytes, fetchImpl) {
  return apiJson(`https://content.dropboxapi.com/2/files/${operation}`, {
    headers: uploadHeaders(token, argument),
    body: bytes,
  }, fetchImpl);
}

export async function uploadEncryptedFile({ path, remotePath, token, fetchImpl = fetch }) {
  const metadata = await privateRegularFile(path);
  if (!required(token)) throw failure("DROPBOX_AUTH_MISSING");
  // Only encrypted dumps and their SHA-256 sidecars at the approved top-level folder.
  if (typeof remotePath !== "string" ||
      !/^\/[A-Za-z0-9/._-]+$/.test(remotePath) ||
      remotePath !== `${DROPBOX_BACKUP_FOLDER}/${basename(remotePath)}` ||
      !/^fc-br-[A-Za-z0-9_-]+\.dump\.fcenc(\.sha256)?$/.test(basename(remotePath))) {
    throw failure("REMOTE_PATH_INVALID");
  }

  const cursorResponse = await contentRequest("upload_session/start", token, { close: false }, Buffer.alloc(0), fetchImpl);
  if (!required(cursorResponse.session_id)) throw failure("SESSION_FAILED");
  const sessionId = cursorResponse.session_id;
  const file = await open(path, "r");
  const buffer = Buffer.allocUnsafe(CONTENT_BLOCK_BYTES);
  let offset = 0;
  try {
    while (offset < metadata.size) {
      const { bytesRead } = await file.read(buffer, 0, Math.min(buffer.length, metadata.size - offset), offset);
      if (bytesRead <= 0) throw failure("FILE_CHANGED");
      // Dropbox append_v2 returns HTTP 200 with no body, even on success.
      await contentRequest("upload_session/append_v2", token, {
        cursor: { session_id: sessionId, offset }, close: false,
      }, buffer.subarray(0, bytesRead), fetchImpl);
      offset += bytesRead;
    }
  } finally { await file.close(); }
  // Finish with an empty body, committing precisely the received offset.
  const result = await contentRequest("upload_session/finish", token, {
    cursor: { session_id: sessionId, offset },
    commit: { path: remotePath, mode: "add", autorename: false, mute: true, strict_conflict: true },
  }, Buffer.alloc(0), fetchImpl);
  if (offset !== metadata.size || result?.path_display !== remotePath ||
      result?.size !== metadata.size || typeof result.content_hash !== "string") {
    throw failure("UPLOAD_UNVERIFIED");
  }
  const digest = await localFileDigests(path);
  if (digest.size !== metadata.size || !matchesDigest(digest.contentHash, result.content_hash)) {
    throw failure("REMOTE_HASH_MISMATCH");
  }
  return Object.freeze({ path: result.path_display, bytes: offset, contentHash: digest.contentHash, sha256: digest.sha256 });
}

export async function uploadVerifiedArchive(env = process.env, { fetchImpl = fetch } = {}) {
  validateBackupSource(env);
  const archivePath = env.RECOVERY_ENCRYPTED_PATH;
  const fileName = validateArchivePath(archivePath);
  const checksumPath = `${archivePath}.sha256`;
  await privateRegularFile(archivePath);
  await privateRegularFile(checksumPath);
  const expectedSha = (await readFile(checksumPath, "utf8")).trim();
  checkDigest(expectedSha);
  // Authenticate GCM using the independent recovery key BEFORE granting the cloud transfer.
  const authenticated = await verifyBackupArchive({
    ...env, RECOVERY_ARCHIVE_APPROVED: "ENCRYPT_OR_VERIFY",
  });
  if (!matchesDigest(authenticated.sha256, expectedSha)) throw failure("SOURCE_CHECKSUM");
  const token = await dropboxAccessToken(env, fetchImpl);
  // Failure after the first upload may leave a partial pair; never claim success.
  const archive = await uploadEncryptedFile({
    path: archivePath,
    remotePath: `${DROPBOX_BACKUP_FOLDER}/${fileName}`,
    token, fetchImpl,
  });
  if (!matchesDigest(archive.sha256, expectedSha)) throw failure("SOURCE_CHANGED");
  const checksum = await uploadEncryptedFile({
    path: checksumPath,
    remotePath: `${DROPBOX_BACKUP_FOLDER}/${fileName}.sha256`,
    token, fetchImpl,
  });
  return Object.freeze({
    status: "ENCRYPTED_OFFSITE_UPLOAD_COMPLETE",
    archivePath: archive.path,
    archiveSha256: archive.sha256,
    checksumPath: checksum.path,
    archiveBytes: archive.bytes,
    checksumBytes: checksum.bytes,
    verifiedUsing: "AES-256-GCM + SHA-256 + Dropbox-content-hash",
    recoveryTestPerformed: false,
  });
}

if (isMainModule(import.meta.url)) {
  uploadVerifiedArchive().then(output => console.log(JSON.stringify(output)))
    .catch(() => { console.error("PRIVATE_BACKUP_UPLOAD_FAILED"); process.exitCode = 1; });
}
