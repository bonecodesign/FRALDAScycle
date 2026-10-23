import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../database/migrations/061_pilot_invitations.sql", import.meta.url), "utf8",
);
const repository = await readFile(
  new URL("../database/pilot-invitation-repository.js", import.meta.url), "utf8",
);

test("pilot invitations persist only a token digest and auditable lifecycle fields", () => {
  assert.match(migration, /CREATE TABLE pilot_invitations/);
  assert.match(migration, /token_hash bytea NOT NULL UNIQUE/);
  assert.doesNotMatch(migration, /token_plain|plaintext_token|token_value/i);
  for (const field of ["issued_by", "request_reference", "expires_at", "consumed_by", "revoked_by", "revocation_reason"]) {
    assert.match(migration, new RegExp(`${field} `));
  }
});

test("database constraints fail closed on duplicate open or contradictory terminal states", () => {
  assert.match(migration, /pilot_invitations_one_open_email_idx/);
  assert.match(migration, /consumed_at IS NULL OR revoked_at IS NULL/);
  assert.match(migration, /expires_at>created_at/);
  assert.match(migration, /email=lower\(trim\(email\)\)/);
});

test("repository supports idempotent issue, atomic consume, revocation and audit without delivery claims", () => {
  assert.match(repository, /pilot_invitation_request_conflict/);
  assert.match(repository, /SET consumed_by=\$2,consumed_at=\$3/);
  assert.match(repository, /pilot\.invitation\.issued/);
  assert.match(repository, /pilot\.invitation\.consumed/);
  assert.match(repository, /pilot\.invitation\.revoked/);
  assert.doesNotMatch(repository, /sendEmail|notification_outbox|provider\.send/);
});

test("repository never returns the stored token digest", () => {
  assert.match(repository, /token_hash: ignored/);
  assert.match(repository, /return invitation/);
});
