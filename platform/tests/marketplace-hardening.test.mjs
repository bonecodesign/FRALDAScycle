import assert from "node:assert/strict";
import test from "node:test";
import { createMarketplaceService } from "../apps/api/marketplace-service.js";

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
  });
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
