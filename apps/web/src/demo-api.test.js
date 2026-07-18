import assert from "node:assert/strict";
import test from "node:test";

import { createDemoApi, initialDemoListings } from "./demo-api.js";

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
