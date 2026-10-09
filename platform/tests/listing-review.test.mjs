import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createAdminService } from "../apps/api/admin-service.js";
import { createAdminRepository } from "../database/admin-repository.js";

const listingId = "22222222-2222-4222-8222-222222222222";
const actorId = "11111111-1111-4111-8111-111111111111";

test("listing review service requires an explicit justified decision", async () => {
  const calls = [];
  const service = createAdminService({ async reviewListing(input) { calls.push(input); return { id: listingId, status: input.outcome }; } });
  await assert.rejects(service.reviewListing({ id: actorId }, listingId, { outcome: "published", reason: "curta", confirmed: true }), (error) => error.code === "invalid_listing_review");
  const result = await service.reviewListing({ id: actorId }, listingId, { outcome: "removed", reason: "Imagem incompatível com o anúncio.", confirmed: true });
  assert.equal(result.status, "removed");
  assert.equal(calls[0].actorUserId, actorId);
});

test("listing review repository locks state, requires media and records the decision", async () => {
  const statements = [];
  const database = { async transaction(operation) { return operation({ async query(sql, values = []) {
    statements.push({ sql, values });
    if (/SELECT id,seller_id,status/.test(sql)) return { rows: [{ id: listingId, seller_id: "seller", status: "review" }] };
    if (/count\(\*\).*listing_media/.test(sql)) return { rows: [{ count: 1 }] };
    if (/UPDATE listings SET status/.test(sql)) return { rows: [{ id: listingId, status: "published" }] };
    return { rows: [] };
  } }); } };
  const result = await createAdminRepository(database).reviewListing({ actorUserId: actorId, listingId, outcome: "published", reason: "Fotos conferidas e produto compatível." });
  assert.equal(result.status, "published");
  assert.ok(statements.some(({ sql }) => /FOR UPDATE/.test(sql)));
  assert.ok(statements.some(({ sql, values }) => /INSERT INTO audit_events/.test(sql) && values.includes("listing.review.approved")));
  assert.ok(statements.some(({ sql }) => /INSERT INTO listing_review_decisions/.test(sql)));
});

test("seller interface reads persisted listing states and review reasons", async () => {
  const [html, controller, repository] = await Promise.all([
    readFile(new URL("../apps/app/profile-ads.html", import.meta.url), "utf8"),
    readFile(new URL("../apps/app/profile.js", import.meta.url), "utf8"),
    readFile(new URL("../database/marketplace-repository.js", import.meta.url), "utf8"),
  ]);
  assert.match(html, /id="profile-ads-list"/);
  assert.match(controller, /\/v1\/account\/listings/);
  assert.match(controller, /item\.review_reason/);
  assert.match(repository, /listing_review_decisions/);
});

test("admin catalog connects protected media review and explicit decision controls", async () => {
  const [html, controller] = await Promise.all([
    readFile(new URL("../apps/admin/ads.html", import.meta.url), "utf8"),
    readFile(new URL("../apps/admin/account-management.js", import.meta.url), "utf8"),
  ]);
  assert.match(html, /id="listing-review-form"/);
  assert.match(html, /name="confirmed"[^>]*required/);
  assert.match(controller, /\/v1\/admin\/listings\/\$\{encodeURIComponent\(listingId\)\}\/review/);
  assert.match(controller, /image\.referrerPolicy = "no-referrer"/);
  assert.doesNotMatch(controller, /innerHTML.*listing-review/);
});
