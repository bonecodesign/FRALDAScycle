import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createApi } from "./app.js";
import { FileListingRepository } from "./file-listing-repository.js";

async function startServer() {
  const server = createApi();

  await new Promise((resolve) => server.listen(0, resolve));

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

const validListing = {
  type: "sell",
  sealed: true,
  brand: "FraldaCycle",
  diaperSize: "M",
  units: 30,
  priceCents: 4590,
  location: {
    city: "São Paulo",
    state: "SP",
  },
};

test("reports that the API is healthy", async () => {
  const api = await startServer();

  try {
    const response = await fetch(`${api.baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  } finally {
    await api.close();
  }
});

test("creates and filters listings", async () => {
  const api = await startServer();

  try {
    const created = await fetch(`${api.baseUrl}/listings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validListing),
    });

    assert.equal(created.status, 201);

    const listing = (await created.json()).listing;
    assert.ok(listing.id);
    assert.ok(listing.createdAt);

    const results = await fetch(
      `${api.baseUrl}/listings?city=são%20paulo&type=sell`,
    );

    assert.equal(results.status, 200);
    assert.equal((await results.json()).listings.length, 1);
  } finally {
    await api.close();
  }
});

test("rejects invalid listing payloads", async () => {
  const api = await startServer();

  try {
    const response = await fetch(`${api.baseUrl}/listings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validListing, sealed: false }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual((await response.json()).errors, [
      "listing must describe a sealed package",
    ]);
  } finally {
    await api.close();
  }
});

test("keeps listings after creating a new repository instance", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fraldacycle-"));
  const dataFile = join(directory, "listings.json");

  try {
    const firstRepository = new FileListingRepository(dataFile);
    await firstRepository.create(validListing);

    const secondRepository = new FileListingRepository(dataFile);
    const listings = await secondRepository.list();

    assert.equal(listings.length, 1);
    assert.equal(listings[0].brand, "FraldaCycle");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
