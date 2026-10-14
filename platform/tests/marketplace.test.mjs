import assert from "node:assert/strict";
import test from "node:test";
import { createMarketplaceService, MarketplaceError } from "../apps/api/marketplace-service.js";
import { createApiServer } from "../apps/api/server.js";
import { loadConfig } from "../apps/api/config.js";
import { createMarketplaceRepository } from "../database/marketplace-repository.js";

const INSTITUTION_ID = "11111111-1111-4111-8111-111111111111";
const syntheticMediaProvider = { async verifyListingMedia() {} };

function repository() {
  const items = [];
  const favorites = new Map();
  return {
    items,
    async search(filters) { return items.filter((item) => !filters.kind || item.kind === filters.kind); },
    async detail(id) { return items.find((item) => item.id === id) ?? null; },
    async activeInstitution(id) { return id === INSTITUTION_ID ? { id, open_packages_accepted: true } : null; },
    async create(input) {
      const item = { id: crypto.randomUUID(), status: "published", ...input };
      items.push(item);
      return item;
    },
    async favorites(userId) { return [...(favorites.get(userId) ?? [])].map((id) => items.find((item) => item.id === id)); },
    async addFavorite(userId, id) {
      const values = favorites.get(userId) ?? new Set();
      values.add(id); favorites.set(userId, values);
    },
    async removeFavorite(userId, id) { favorites.get(userId)?.delete(id); },
    async startTransaction({ buyerId, listingId }) {
      const item = items.find((candidate) => candidate.id === listingId && candidate.status === "published");
      if (!item || item.sellerId === buyerId) return null;
      item.status = "unavailable";
      return { id: crypto.randomUUID(), buyerId, listingId, status: "initiated" };
    },
    async cancelTransaction({ transactionId }) { return { id: transactionId, status: "cancelled" }; },
    async completeTransaction({ transactionId }) { return { id: transactionId, status: "completed" }; },
    async chatAccess() { return { kind: "sale", status: "paid", payment_confirmed: true }; },
  };
}

test("marketplace publishes sale exchange and donation with product invariants", async () => {
  const service = createMarketplaceService(repository(), null, syntheticMediaProvider);
  const sale = await service.create("seller-1", {
    title: "Pampers Confort M", description: "Pacote fechado com cinquenta unidades.", kind: "sale",
    quantity: 50, priceCents: 4500, size: "M", category: "infant",
    brand: "Pampers", model: "Confort Sec", packageCondition: "sealed",
    mediaKeys: ["listings/seller-1/synthetic.webp"],
  });
  assert.equal(sale.status, "published");
  await assert.rejects(
    service.create("seller-1", {
      title: "Doação segura", description: "Pacote fechado e em ótimo estado.", kind: "donation",
      quantity: 20, priceCents: 100, category: "infant", brand: "Pampers",
      model: "Confort Sec", packageCondition: "sealed",
    }),
    (error) => error instanceof MarketplaceError && error.code === "unexpected_price",
  );
});

test("marketplace search detail and favorites preserve ownership boundaries", async () => {
  const store = repository();
  const service = createMarketplaceService(store, null, syntheticMediaProvider);
  const item = await service.create("seller-1", {
    title: "Huggies Supreme G", description: "Pacote lacrado com quarenta unidades.", kind: "sale",
    quantity: 40, priceCents: 4000, category: "infant", brand: "Huggies",
    model: "Máxima Proteção", packageCondition: "sealed",
    mediaKeys: ["listings/seller-1/synthetic.webp"],
  });
  assert.equal((await service.search({ kind: "sale" })).length, 1);
  assert.equal((await service.detail(item.id)).title, "Huggies Supreme G");
  await service.addFavorite("buyer-1", item.id);
  assert.equal((await service.favorites("buyer-1")).length, 1);
  await service.removeFavorite("buyer-1", item.id);
  assert.equal((await service.favorites("buyer-1")).length, 0);
  await assert.rejects(service.detail(crypto.randomUUID()), /não encontrado/i);
});

test("marketplace accepts open packages only for attested donations", async () => {
  const service = createMarketplaceService(repository(), null, syntheticMediaProvider);
  const base = {
    title: "Pampers Confort Sec M", description: "Pacote aberto, limpo, seco e armazenado corretamente.",
    quantity: 18, category: "infant", brand: "Pampers", model: "Confort Sec", packageCondition: "open",
    institutionId: INSTITUTION_ID,
    mediaKeys: ["listings/seller-1/synthetic.webp"],
  };
  await assert.rejects(
    service.create("seller-1", { ...base, kind: "sale", priceCents: 2500, openPackageAttested: true }),
    (error) => error.code === "open_package_not_allowed",
  );
  await assert.rejects(
    service.create("seller-1", { ...base, kind: "donation" }),
    (error) => error.code === "open_package_attestation_required",
  );
  const donation = await service.create("seller-1", { ...base, kind: "donation", openPackageAttested: true });
  assert.equal(donation.packageCondition, "open");
  assert.equal(donation.openPackageAttested, true);
});

test("marketplace permits only disposable infant and swim catalog models", async () => {
  const service = createMarketplaceService(repository(), null, syntheticMediaProvider);
  const base = {
    title: "Fralda descartável", description: "Pacote fechado e armazenado em ambiente limpo e seco.",
    kind: "donation", quantity: 12, packageCondition: "sealed", institutionId: INSTITUTION_ID,
    mediaKeys: ["listings/seller-1/synthetic.webp"],
  };
  await assert.rejects(
    service.create("seller-1", { ...base, category: "adult", brand: "Outro", model: "Geriátrica" }),
    (error) => error.code === "invalid_category",
  );
  await assert.rejects(
    service.create("seller-1", { ...base, category: "infant", brand: "Marca inexistente", model: "Reutilizável" }),
    (error) => error.code === "unsupported_model",
  );
  const swim = await service.create("seller-1", {
    ...base, category: "swim", brand: "Pampers", model: "Splashers",
  });
  assert.equal(swim.category, "swim");
});

test("starting a transaction makes its listing immediately unavailable", async () => {
  const store = repository();
  const service = createMarketplaceService(store, null, syntheticMediaProvider);
  const listing = await service.create("seller-1", {
    title: "Huggies Natural Care M", description: "Pacote fechado com vinte e quatro unidades.",
    kind: "sale", quantity: 24, priceCents: 3000, category: "infant", brand: "Huggies",
    model: "Natural Care", packageCondition: "sealed",
    mediaKeys: ["listings/seller-1/synthetic.webp"],
  });
  const transaction = await service.startTransaction("buyer-1", listing.id);
  assert.equal(transaction.status, "initiated");
  assert.equal(listing.status, "unavailable");
  assert.equal(await service.startTransaction("buyer-2", listing.id), null);
});

test("chat access is authorized by transaction participation and confirmed payment", async () => {
  const store = repository();
  const service = createMarketplaceService(store);
  const allowed = await service.chatAccess("buyer-1", "22222222-2222-4222-8222-222222222222");
  assert.deepEqual(allowed, { allowed: true, reason: "payment_confirmed" });
  store.chatAccess = async () => ({ kind: "sale", status: "initiated", payment_confirmed: false });
  assert.deepEqual(await service.chatAccess("buyer-1", "22222222-2222-4222-8222-222222222222"), {
    allowed: false, reason: "payment_not_confirmed",
  });
});

test("HTTP marketplace keeps public reads open, forwards category/size, and protects writes", async (context) => {
  let searchFilters;
  const marketplaceService = {
    async search(filters) { searchFilters = filters; return [{ id: "item-1", title: "Fraldas M" }]; },
    async detail() { return { id: "item-1", title: "Fraldas M" }; },
    async create(userId, input) { return { id: "item-2", sellerId: userId, ...input }; },
    async favorites() { return []; },
    async addFavorite() { return { saved: true }; },
    async removeFavorite() { return { saved: false }; },
  };
  const authService = { async session(token) { return token === "valid" ? { id: "user-1", adultDeclared: true } : token === "undeclared" ? { id: "user-2", adultDeclared: false } : null; } };
  const server = createApiServer({ config: loadConfig({ NODE_ENV: "test" }), authService, marketplaceService });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;

  const search = await fetch(`${origin}/v1/listings`);
  assert.equal(search.status, 200);
  assert.equal((await search.json()).items.length, 1);
  const filtered = await fetch(`${origin}/v1/listings?category=swim&size=RN%2B`);
  assert.equal(filtered.status, 200);
  assert.equal(searchFilters.category, "swim");
  assert.equal(searchFilters.size, "RN+");

  const denied = await fetch(`${origin}/v1/listings`, {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}",
  });
  assert.equal(denied.status, 401);

  const undeclared = await fetch(`${origin}/v1/listings`, {
    method: "POST", headers: { "content-type": "application/json", cookie: "fc_session=undeclared" }, body: "{}",
  });
  assert.equal(undeclared.status, 403);
  assert.equal((await undeclared.json()).error.code, "adult_declaration_required");

  const created = await fetch(`${origin}/v1/listings`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "fc_session=valid" },
    body: JSON.stringify({ title: "Fraldas M" }),
  });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).listing.sellerId, "user-1");
});

test("marketplace validates radius and orders PostgreSQL results by distance", async () => {
  let filters;
  const store = repository();
  store.search = async (input) => { filters = input; return []; };
  const service = createMarketplaceService(store);
  await service.search({ category: "swim", size: "P/M" });
  assert.equal(filters.category, "swim");
  assert.equal(filters.size, "P/M");
  await assert.rejects(service.search({ category: "reusable" }), error => error.code === "invalid_category" && error.status === 422);
  await service.search({ latitude: "-19.9167", longitude: "-43.9345", radiusKm: "15" });
  assert.equal(filters.latitude, -19.9167);
  assert.equal(filters.longitude, -43.9345);
  assert.equal(filters.radiusKm, 15);
  await assert.rejects(
    service.search({ latitude: "-19.9" }),
    (error) => error.code === "invalid_location" && error.status === 422,
  );

  let query;
  const database = { async query(text, values) { query = { text, values }; return { rows: [] }; } };
  await createMarketplaceRepository(database).search(filters);
  assert.match(query.text, /distance_km/);
  assert.match(query.text, /6371 \* acos/);
  assert.match(query.text, /ORDER BY distance_km ASC NULLS LAST/);
  assert.deepEqual(query.values.slice(4, 7), [-19.9167, -43.9345, 15]);
  await createMarketplaceRepository(database).search({ ...filters, category: "swim", size: "P/M" });
  assert.match(query.text, /\(\$4::text IS NULL OR l\.category = \$4\)/);
  assert.deepEqual(query.values.slice(2, 5), ["P/M", "swim", -19.9167]);
});
