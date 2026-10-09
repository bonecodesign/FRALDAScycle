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

test("approval fails before persistence when media verification is absent or fails", async () => {
  let writes = 0;
  const repository = {
    async listingReviewDetail() { return { listing: { seller_id: "seller", status: "review", updated_at: "2026-10-09T00:00:00Z" }, media: [{ storage_key: "listings/seller/one.webp" }] }; },
    async reviewListing() { writes++; return {}; },
  };
  const input = { outcome: "published", reason: "Produto e fotos revisados com atenção.", confirmed: true };
  await assert.rejects(createAdminService(repository).reviewListing({ id: actorId }, listingId, input), error => error.code === "media_verification_unavailable");
  const service = createAdminService(repository, { async verifyListingMedia() {
    throw Object.assign(new Error("Not processed"), { code: "media_not_ready" });
  } }, { reviewSecret: "test-secret".repeat(4) });
  const reviewContext = service.issueReviewContext({ id: actorId }, await repository.listingReviewDetail(), [{ expiresAt: new Date(Date.now() + 60_000).toISOString() }]);
  await assert.rejects(service.reviewListing({ id: actorId }, listingId, { ...input, reviewContext }), error => error.code === "media_not_ready");
  assert.equal(writes, 0);
});

test("approval authorization is bound to actor, session, content and expiration", async () => {
  let writes = 0;
  const detail = { listing: { id: listingId, seller_id: "seller", status: "review", title: "Original", updated_at: "2026-10-09T00:00:00Z" }, media: [{ storage_key: "listings/seller/one.webp" }] };
  const service = createAdminService({
    async listingReviewDetail() { return detail; }, async reviewListing() { writes++; return { status: "published" }; },
  }, { async verifyListingMedia() {} }, { reviewSecret: "test-secret".repeat(4) });
  const actor = { id: actorId, sessionId: "session-1" };
  const reviewContext = service.issueReviewContext(actor, detail, [{ expiresAt: new Date(Date.now() + 60_000).toISOString() }]);
  const input = { outcome: "published", reason: "Todas as fotos foram conferidas.", confirmed: true, reviewContext };
  for (const other of [{ id: "other", sessionId: "session-1" }, { ...actor, sessionId: "other" }]) {
    await assert.rejects(service.reviewListing(other, listingId, input), error => error.code === "listing_review_context_expired");
  }
  await assert.rejects(service.reviewListing(actor, listingId, { ...input, reviewContext: reviewContext + "tampered" }), error => error.code === "listing_review_context_expired");
  detail.listing.title = "Alterado";
  await assert.rejects(service.reviewListing(actor, listingId, input), error => error.code === "listing_review_context_expired");
  detail.listing.title = "Original";
  assert.equal(service.issueReviewContext(actor, detail, [{ expiresAt: new Date(Date.now() - 1_000).toISOString() }]), null);
  assert.equal(writes, 0);
  assert.equal((await service.reviewListing(actor, listingId, input)).status, "published");
});

test("listing review repository locks state, requires media and records the decision", async () => {
  const statements = [];
  const database = { async transaction(operation) { return operation({ async query(sql, values = []) {
    statements.push({ sql, values });
    if (/SELECT seller_id FROM listings/.test(sql)) return { rows: [{ seller_id: "seller" }] };
    if (/SELECT id FROM users/.test(sql)) return { rows: [{ id: "seller" }] };
    if (/AS checked_at/.test(sql)) return { rows: [{ checked_at: new Date(), subscription: null }] };
    if (/SELECT disabled_at/.test(sql)) return { rows: [{ disabled_at: null }] };
    if (/AS suspended/.test(sql)) return { rows: [{ suspended: false }] };
    if (/count\(\*\).*FROM listings/.test(sql)) return { rows: [{ count: 2 }] };
    if (/SELECT id,seller_id,status/.test(sql)) return { rows: [{ id: listingId, seller_id: "seller", status: "review", updated_at: "2026-10-09T00:00:00Z" }] };
    if (/count\(\*\).*listing_media/.test(sql)) return { rows: [{ count: 1 }] };
    if (/UPDATE listings SET status/.test(sql)) return { rows: [{ id: listingId, status: "published" }] };
    return { rows: [] };
  } }); } };
  const result = await createAdminRepository(database).reviewListing({ actorUserId: actorId, listingId, outcome: "published", reason: "Fotos conferidas e produto compatível.", expectedUpdatedAt: "2026-10-09T00:00:00Z" });
  assert.equal(result.status, "published");
  assert.ok(statements.some(({ sql }) => /FOR UPDATE/.test(sql)));
  assert.ok(statements.some(({ sql, values }) => /INSERT INTO audit_events/.test(sql) && values.includes("listing.review.approved")));
  assert.ok(statements.some(({ sql }) => /INSERT INTO listing_review_decisions/.test(sql)));
});

test("approval checks current account, quota, operational pause and donation eligibility before writes", async () => {
  async function review(options = {}) {
    const calls = [];
    const database = { async transaction(operation) { return operation({ async query(sql, values = []) {
      calls.push({ sql, values });
      if (/FROM operational_controls/.test(sql)) return { rows: [
        { domain: "global", paused: Boolean(options.paused) },
        { domain: "marketplace", paused: false }, { domain: "donations", paused: Boolean(options.donationsPaused) },
      ] };
      if (/SELECT seller_id FROM listings/.test(sql)) return { rows: [{ seller_id: "seller" }] };
      if (/SELECT id FROM users/.test(sql)) return { rows: [{ id: "seller" }] };
      if (/AS checked_at/.test(sql)) return { rows: [{ checked_at: new Date("2026-10-09T00:00:00Z"), subscription: options.premium ? {
        paid_period_start: "2026-10-01T00:00:00Z", paid_period_end: "2026-11-01T00:00:00Z", renewal_enabled: true,
      } : null }] };
      if (/SELECT disabled_at/.test(sql)) return { rows: [{ disabled_at: options.disabled ? new Date() : null }] };
      if (/AS suspended/.test(sql)) return { rows: [{ suspended: Boolean(options.suspended) }] };
      if (/SELECT id,seller_id,status/.test(sql)) return { rows: [{ id: listingId, seller_id: "seller", status: "review",
        kind: options.donation ? "donation" : "sale", institution_id: "institution", package_condition: "sealed", updated_at: "2026-10-09T00:00:00Z" }] };
      if (/FROM institutions/.test(sql)) return { rows: [{ status: options.institutionInactive ? "inactive" : "active", open_packages_accepted: true }] };
      if (/count\(\*\).*FROM listings/.test(sql)) return { rows: [{ count: options.count ?? 2 }] };
      if (/count\(\*\).*listing_media/.test(sql)) return { rows: [{ count: 1 }] };
      if (/UPDATE listings SET/.test(sql)) return { rows: [{ id: listingId, status: "published" }] };
      return { rows: [] };
    } }); } };
    const result = createAdminRepository(database).reviewListing({ actorUserId: actorId, listingId, outcome: "published",
      reason: "Produto e imagens conferidos.", expectedUpdatedAt: "2026-10-09T00:00:00Z" });
    return { result, calls };
  }
  for (const [options, code] of [
    [{ count: 3 }, "free_listing_limit"], [{ disabled: true }, "seller_account_unavailable"],
    [{ suspended: true }, "new_operations_suspended"], [{ paused: true }, "operational_paused"],
    [{ donation: true, donationsPaused: true }, "operational_paused"],
    [{ donation: true, institutionInactive: true }, "donation_institution_unavailable"],
  ]) {
    const { result, calls } = await review(options);
    await assert.rejects(result, error => error.code === code);
    assert.equal(calls.some(({ sql }) => /UPDATE listings|INSERT INTO listing_review_decisions/.test(sql)), false);
  }
  const { result, calls } = await review({ premium: true, count: 10 });
  assert.equal((await result).status, "published");
  const accountLock = calls.findIndex(({ sql }) => /FROM users.*FOR NO KEY UPDATE/.test(sql));
  const listingLock = calls.findIndex(({ sql }) => /FROM listings.*FOR UPDATE/.test(sql));
  assert.ok(accountLock >= 0 && accountLock < listingLock);
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
