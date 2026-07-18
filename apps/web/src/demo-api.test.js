import assert from "node:assert/strict";
import test from "node:test";

import {
  createDemoApi,
  initialDemoListings,
  resetDemoListings,
} from "./demo-api.js";

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function createContext(user = null) {
  const storage = createMemoryStorage();
  const apiFetch = createDemoApi({
    storage,
    getUser: () => user,
    now: () => 123,
  });
  return { apiFetch, storage };
}

test("loads and filters the initial demonstrative marketplace", async () => {
  const { apiFetch } = createContext();
  const all = await (await apiFetch("/demo-api/listings")).json();
  assert.equal(all.listings.length, initialDemoListings.length);

  const donations = await (
    await apiFetch("/demo-api/listings?city=belo%20horizonte&state=mg&type=donate")
  ).json();
  assert.equal(donations.listings.length, 2);
  assert.ok(donations.listings.every((listing) => listing.type === "donate"));
});

test("accepts only clearly identified tester accounts", async () => {
  const { apiFetch } = createContext();
  const invalid = await apiFetch("/demo-api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "familia@example.com", password: "12345678" }),
  });
  assert.equal(invalid.status, 400);

  const shortPassword = await apiFetch("/demo-api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "familia@tester.fraldacycle.local",
      password: "curta",
    }),
  });
  assert.equal(shortPassword.status, 400);

  const valid = await apiFetch("/demo-api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: "FAMILIA@tester.fraldacycle.local",
      password: "12345678",
    }),
  });
  assert.equal(valid.status, 200);
  assert.equal(
    (await valid.json()).user.email,
    "familia@tester.fraldacycle.local",
  );
});

test("publishes, lists and removes only the signed-in user's offers", async () => {
  const user = { email: "familia@tester.fraldacycle.local" };
  const { apiFetch } = createContext(user);
  const payload = {
    type: "donate",
    sealed: true,
    brand: "Pacote demonstrativo",
    diaperSize: "M",
    units: 24,
    location: { city: "Belo Horizonte", state: "MG" },
  };

  const created = await apiFetch("/demo-api/listings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).listing.id, "demo-123");

  const mine = await (await apiFetch("/demo-api/my/listings")).json();
  assert.deepEqual(mine.listings.map((listing) => listing.id), ["demo-123"]);

  const removed = await apiFetch("/demo-api/listings/demo-123", {
    method: "DELETE",
  });
  assert.equal(removed.status, 200);
  assert.equal((await (await apiFetch("/demo-api/my/listings")).json()).listings.length, 0);

  const protectedOffer = await apiFetch("/demo-api/listings/demo-1", {
    method: "DELETE",
  });
  assert.equal(protectedOffer.status, 404);
});

test("recovers safely when stored demonstration data is corrupted", async () => {
  const { apiFetch, storage } = createContext();
  storage.setItem("fraldacycle.demo.listings", "{broken");
  const response = await (await apiFetch("/demo-api/listings")).json();
  assert.equal(response.listings.length, initialDemoListings.length);
});

test("rejects invalid local listings with the domain safety rules", async () => {
  const user = { email: "familia@tester.fraldacycle.local" };
  const { apiFetch } = createContext(user);

  const response = await apiFetch("/demo-api/listings", {
    method: "POST",
    body: JSON.stringify({
      type: "donate",
      sealed: false,
      brand: "",
      diaperSize: "",
      units: 0,
      priceCents: 100,
      photoUrl: "javascript:alert(1)",
      location: {},
    }),
  });

  assert.equal(response.status, 400);
  const { errors } = await response.json();
  assert.ok(errors.includes("listing must describe a sealed package"));
  assert.ok(errors.includes("brand is required"));
  assert.ok(errors.includes("units must be a positive integer"));
  assert.ok(errors.includes("photoUrl must be a valid http or https URL"));
  assert.ok(errors.includes("donate listings cannot include priceCents"));
});

test("normalizes local listing text before persistence", async () => {
  const user = { email: "familia@tester.fraldacycle.local" };
  const { apiFetch } = createContext(user);

  const response = await apiFetch("/demo-api/listings", {
    method: "POST",
    body: JSON.stringify({
      type: "sell",
      sealed: true,
      brand: "  Marca teste  ",
      diaperSize: " G ",
      units: 20,
      priceCents: 4590,
      photoUrl: " https://example.com/pacote.png ",
      location: { city: " Belo Horizonte ", state: " mg " },
    }),
  });

  assert.equal(response.status, 201);
  const { listing } = await response.json();
  assert.equal(listing.brand, "Marca teste");
  assert.equal(listing.diaperSize, "G");
  assert.equal(listing.photoUrl, "https://example.com/pacote.png");
  assert.deepEqual(listing.location, { city: "Belo Horizonte", state: "MG" });
});

test("restores the initial dataset without affecting other browser data", async () => {
  const { apiFetch, storage } = createContext({
    email: "familia@tester.fraldacycle.local",
  });
  storage.setItem("unrelated.preference", "preserved");

  await apiFetch("/demo-api/listings", {
    method: "POST",
    body: JSON.stringify({
      type: "donate",
      sealed: true,
      brand: "Temporária",
      diaperSize: "P",
      units: 10,
      location: { city: "Belo Horizonte", state: "MG" },
    }),
  });

  resetDemoListings(storage);
  const restored = await (await apiFetch("/demo-api/listings")).json();
  assert.equal(restored.listings.length, initialDemoListings.length);
  assert.equal(storage.getItem("unrelated.preference"), "preserved");
});
