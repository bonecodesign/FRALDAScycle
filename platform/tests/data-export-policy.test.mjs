import assert from "node:assert/strict";
import { createDecipheriv, scrypt as deriveKey } from "node:crypto";
import { promisify } from "node:util";
import test from "node:test";
import { dataExportArtifactWindow, dataExportRequestDecision, encryptDataExport } from "../packages/contracts/data-export-policy.js";

const scrypt = promisify(deriveKey);

test("data export requires both verifications and a 30-day interval", () => {
  const now = Date.parse("2030-03-31T00:00:00Z");
  assert.equal(dataExportRequestDecision({ passwordVerified: true, emailCodeVerified: true, now }).allowed, true);
  assert.deepEqual(dataExportRequestDecision({ passwordVerified: false, emailCodeVerified: false, now }).blockers,
    ["password_verification_required", "email_code_verification_required"]);
  assert.deepEqual(dataExportRequestDecision({ passwordVerified: true, emailCodeVerified: true, lastRequestedAt: "2030-03-02T00:00:00Z", now }).blockers,
    ["export_request_interval"]);
  assert.equal(dataExportRequestDecision({ passwordVerified: true, emailCodeVerified: true, lastRequestedAt: "2030-03-01T00:00:00Z", now }).allowed, true);
});

test("download artifact is available for exactly seven days", () => {
  const readyAt = "2030-01-01T00:00:00Z";
  assert.equal(dataExportArtifactWindow({ readyAt, now: Date.parse("2030-01-07T23:59:59Z") }).downloadable, true);
  assert.deepEqual(dataExportArtifactWindow({ readyAt, now: Date.parse("2030-01-08T00:00:00Z") }), {
    downloadable: false, expiresAt: "2030-01-08T00:00:00.000Z", reason: "artifact_expired",
  });
});

test("export encryption produces an authenticated envelope without retaining the password", async () => {
  let counter = 0;
  const envelope = await encryptDataExport({ account: { email: "ana@example.test" }, childProfiles: [{ birthDate: "2029-01-01" }] }, "correct horse battery", {
    randomBytes(length) { counter++; return Buffer.alloc(length, counter); },
  });
  assert.equal(envelope.algorithm, "aes-256-gcm");
  assert.equal(JSON.stringify(envelope).includes("correct horse battery"), false);
  assert.equal(JSON.stringify(envelope).includes("2029-01-01"), false);
  const key = await scrypt("correct horse battery", Buffer.from(envelope.salt, "base64"), 32, { N: 16_384, r: 8, p: 1 });
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.authenticationTag, "base64"));
  const decoded = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64")), decipher.final()]).toString("utf8"));
  assert.equal(decoded.childProfiles[0].birthDate, "2029-01-01");
});

test("export refuses secrets and weak passwords before producing an artifact", async () => {
  await assert.rejects(encryptDataExport({ token: "provider-secret" }, "correct horse battery"), /forbidden secrets/);
  await assert.rejects(encryptDataExport({ account: {} }, "short"), /Invalid export password/);
});
