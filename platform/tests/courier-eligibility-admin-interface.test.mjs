import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../apps/admin/logistics.html", import.meta.url), "utf8");
const script = await readFile(new URL("../apps/admin/courier-eligibility-admin.js", import.meta.url), "utf8");

test("admin logistics has an accessible courier eligibility workspace", () => {
  assert.match(html, /id="courier-clearance-heading"/);
  assert.match(html, /id="courier-clearance-status" class="notice" role="status" aria-live="polite"/);
  assert.match(html, /courier-eligibility-admin\.js/);
});

test("admin browser receives metadata but has no document or encryption-key access action", () => {
  assert.match(html, /O documento e a chave criptográfica não são enviados ao navegador/);
  assert.doesNotMatch(script, /documents\/.+\/access|encryptionKey|encryptedObject/);
});

test("review and suspension actions are explicit and server backed", () => {
  assert.match(script, /courier-clearance\/reviews/);
  assert.match(script, /courier-clearance\/suspensions/);
  assert.match(script, /confirmed: true/);
  assert.match(script, /auditReference/);
  assert.match(script, /support\/close-expired/);
});

test("separate bounded queues route work to reviewers and support", () => {
  assert.match(html, /id="courier-review-queue"/);
  assert.match(html, /id="courier-support-queue"/);
  assert.match(script, /review-queue\?limit=50/);
  assert.match(script, /support-queue\?limit=50/);
  assert.match(script, /Promise\.allSettled/);
});
