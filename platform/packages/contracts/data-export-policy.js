import { createCipheriv, randomBytes as secureRandomBytes, scrypt as deriveKey } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(deriveKey);
const REQUEST_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
const DOWNLOAD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function timestamp(value) {
  const parsed = value == null ? null : Date.parse(value);
  return parsed != null && Number.isFinite(parsed) ? parsed : null;
}

export function dataExportRequestDecision({ passwordVerified, emailCodeVerified, lastRequestedAt = null, now = Date.now() }) {
  const blockers = [];
  if (passwordVerified !== true) blockers.push("password_verification_required");
  if (emailCodeVerified !== true) blockers.push("email_code_verification_required");
  const previous = timestamp(lastRequestedAt);
  if (previous != null && (previous > now || now - previous < REQUEST_INTERVAL_MS)) blockers.push("export_request_interval");
  return Object.freeze({ allowed: blockers.length === 0, blockers: Object.freeze(blockers) });
}

export function dataExportArtifactWindow({ readyAt, now = Date.now() }) {
  const ready = timestamp(readyAt);
  if (ready == null || ready > now) return Object.freeze({ downloadable: false, reason: "artifact_not_ready" });
  const expiresAt = ready + DOWNLOAD_WINDOW_MS;
  return Object.freeze({ downloadable: now < expiresAt, expiresAt: new Date(expiresAt).toISOString(), reason: now < expiresAt ? null : "artifact_expired" });
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid export payload");
  const serialized = JSON.stringify(payload);
  if (/"(?:password|passwordHash|token|secret|cvv|cardNumber|antifraud)"\s*:/i.test(serialized)) {
    throw new Error("Export payload contains forbidden secrets");
  }
  return serialized;
}

// The password exists only in this call and is never returned. The envelope is
// self-contained so a worker can persist it without persisting the password.
export async function encryptDataExport(payload, password, { randomBytes = secureRandomBytes } = {}) {
  if (typeof password !== "string" || password.length < 12 || password.length > 256) throw new Error("Invalid export password");
  const plaintext = Buffer.from(validatePayload(payload), "utf8");
  const salt = randomBytes(16), iv = randomBytes(12);
  const key = await scrypt(password, salt, 32, { N: 16_384, r: 8, p: 1 });
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Object.freeze({
    version: 1, algorithm: "aes-256-gcm", keyDerivation: "scrypt-n16384-r8-p1",
    salt: salt.toString("base64"), iv: iv.toString("base64"),
    authenticationTag: cipher.getAuthTag().toString("base64"), data: ciphertext.toString("base64"),
  });
}
