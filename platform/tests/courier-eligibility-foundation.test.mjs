import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../database/migrations/060_courier_eligibility_foundation.sql", import.meta.url),
  "utf8",
);

test("courier eligibility persistence is normalized by operational responsibility", () => {
  for (const table of [
    "courier_profiles",
    "courier_vehicles",
    "courier_clearance_reviewers",
    "courier_clearance_support_supervisors",
    "courier_clearance_documents",
    "courier_clearance_reviews",
    "courier_clearance_suspensions",
    "courier_clearance_access_audit",
    "courier_eligibility_maintenance_tasks",
  ]) assert.match(migration, new RegExp(`CREATE TABLE ${table} \\(`));
});

test("restricted document storage persists opaque encrypted references and an exact deletion deadline", () => {
  assert.match(migration, /encrypted_object_reference text NOT NULL UNIQUE/);
  assert.match(migration, /encryption_key_reference text NOT NULL/);
  assert.match(migration, /access_scope text NOT NULL CHECK \(access_scope = 'courier_clearance_reviewers'\)/);
  assert.match(migration, /delete_at = expires_at \+ interval '30 days'/);
  assert.doesNotMatch(migration, /document_(bytes|content|url)/i);
  assert.match(migration, /admin role alone never grants police-clearance object access/);
});

test("review, support and supervisor deadlines are enforced by database constraints", () => {
  assert.match(migration, /due_at = submitted_at \+ interval '24 hours'/);
  assert.match(migration, /support_due_at = support_opened_at \+ interval '24 hours'/);
  assert.match(migration, /supervisor_due_at = support_due_at \+ interval '24 hours'/);
  assert.match(migration, /release_reviewer_role = 'support_supervisor'/);
  assert.match(migration, /closed_sla_expired/);
});

test("only one current vehicle, pending review and open suspension can exist per courier", () => {
  assert.match(migration, /courier_vehicles_one_current_idx/);
  assert.match(migration, /courier_clearance_reviews_one_pending_idx/);
  assert.match(migration, /courier_clearance_suspensions_one_open_idx/);
});

test("maintenance obligations are idempotent, bounded and separated from direct provider effects", () => {
  assert.match(migration, /task_key text NOT NULL UNIQUE/);
  assert.match(migration, /'renewal_notice','support_escalation','support_sla_close','clearance_copy_delete'/);
  assert.match(migration, /attempts BETWEEN 0 AND 8/);
  assert.match(migration, /scheduling never sends a message or deletes a provider object directly/);
});
