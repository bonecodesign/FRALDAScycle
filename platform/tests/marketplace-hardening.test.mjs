import assert from "node:assert/strict";
import test from "node:test";
import { createMarketplaceService } from "../apps/api/marketplace-service.js";
import { createMarketplaceRepository } from "../database/marketplace-repository.js";
import { controlledDomain } from "../apps/api/operational-control.js";

const sellerId = "11111111-1111-4111-8111-111111111111";
const base = {
  title: "Pacote infantil fechado",
  description: "Pacote íntegro e fechado, dentro da validade informada.",
  kind: "sale", quantity: 20, priceCents: 3500,
  category: "infant", packageCondition: "sealed",
  brand: "Pampers", model: "Confort Sec", size: "M",
};

function service() {
  return createMarketplaceService({
    async create(input) { return input; },
    async addFavorite() {}, async removeFavorite() {},
    async detail() { return { kind: "sale" }; },
    async startTransaction() { return {}; },
  }, null, { async verifyListingMedia() { return { verified: true }; } });
}

test("listing publication accepts only bounded location and seller-owned media keys", async () => {
  const marketplace = service();
  const created = await marketplace.create(sellerId, {
    ...base, city: "Belo Horizonte", state: "mg", latitude: -19.92, longitude: -43.94,
    mediaKeys: [`listings/${sellerId}/photo-1.webp`],
  });
  assert.equal(created.state, "MG");
  assert.equal(created.mediaKeys.length, 1);

  for (const invalid of [
    { latitude: -19.92 },
    { latitude: 91, longitude: -43.94 },
    { state: "Minas Gerais" },
    { quantity: 100_001 },
    { mediaKeys: ["listings/another-user/photo.webp"] },
    { mediaKeys: [`listings/${sellerId}/../private.webp`] },
    { mediaKeys: Array(9).fill(0).map((_, index) => `listings/${sellerId}/${index}.webp`) },
  ]) {
    await assert.rejects(marketplace.create(sellerId, { ...base, ...invalid }), (error) => error.status === 422);
  }
});

test("favorite and transaction identifiers fail closed before persistence", async () => {
  const marketplace = service();
  await assert.rejects(marketplace.addFavorite(sellerId, "invalid"), (error) => error.code === "listing_not_found");
  await assert.rejects(marketplace.startTransaction(sellerId, "invalid"), (error) => error.code === "listing_not_found");
});

test("new listing without photos cannot reach persistence", async () => {
  let writes = 0;
  const marketplace = createMarketplaceService({ async create() { writes++; } });
  await assert.rejects(marketplace.create(sellerId, base), error => error.code === "listing_media_required");
  assert.equal(writes, 0);
});

test("resubmission blocks ownership failures, stale versions, unchanged content and active operations", async () => {
  const listingId = "22222222-2222-4222-8222-222222222222";
  const updatedAt = "2026-10-09T00:00:00.000Z";
  const original = { id: listingId, seller_id: sellerId, kind: "sale", status: "removed",
    title: base.title, description: base.description, updated_at: updatedAt };
  function repository({ listing = original, ongoing = false, decision = "removed" } = {}) {
    const writes = [];
    return { writes, value: createMarketplaceRepository({ async transaction(operation) {
      return operation({ async query(sql, values) {
        if (/AS suspended/.test(sql)) return { rows: [{ suspended: false }] };
        if (/SELECT \* FROM listings/.test(sql)) return { rows: listing ? [listing] : [] };
        if (/SELECT outcome/.test(sql)) return { rows: [{ outcome: decision }] };
        if (/SELECT id FROM transactions/.test(sql)) return { rows: ongoing ? [{ id: "operation" }] : [] };
        if (/SELECT storage_key/.test(sql)) return { rows: [{ storage_key: `listings/${sellerId}/old.webp` }] };
        writes.push({ sql, values });
        if (/UPDATE listings SET/.test(sql)) return { rows: [{ id: listingId, status: "review" }] };
        return { rows: [] };
      } });
    } }) };
  }
  const input = { sellerId, listingId, title: "Título corrigido do pacote", description: base.description, expectedUpdatedAt: updatedAt };
  for (const [options, patch, code] of [
    [{ listing: null }, {}, "listing_not_found"],
    [{}, { expectedUpdatedAt: "2026-10-08T00:00:00Z" }, "listing_resubmission_conflict"],
    [{}, { title: base.title }, "listing_correction_required"],
    [{ ongoing: true }, {}, "listing_operation_active"],
    [{ decision: "published" }, {}, "listing_resubmission_unavailable"],
  ]) {
    const instance = repository(options);
    await assert.rejects(instance.value.resubmitListing({ ...input, ...patch }), error => error.code === code);
    assert.equal(instance.writes.some(({ sql }) => /UPDATE listings|DELETE FROM listing_media/.test(sql)), false);
  }
  const instance = repository();
  assert.equal((await instance.value.resubmitListing(input)).status, "review");
  assert.ok(instance.writes.some(({ sql }) => /listing.review.resubmitted/.test(sql)));
  assert.equal(instance.writes.some(({ sql }) => /DELETE FROM listing_review_decisions/.test(sql)), false);
  assert.equal(controlledDomain("POST", `/v1/account/listings/${listingId}/resubmit`), "marketplace");
});
