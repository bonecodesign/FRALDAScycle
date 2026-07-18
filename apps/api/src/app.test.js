import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AuthService } from "./auth-service.js";
import { createApi } from "./app.js";
import { FileListingRepository } from "./file-listing-repository.js";
import { FileUserRepository } from "./file-user-repository.js";

async function startServer(options) {
  const server = createApi(options);

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

async function createAuthenticatedApi() {
  const directory = await mkdtemp(join(tmpdir(), "fraldacycle-"));
  const userRepository = new FileUserRepository(join(directory, "users.json"));
  const repository = new FileListingRepository(join(directory, "listings.json"));
  const authService = new AuthService({
    secret: "a-secret-that-is-longer-than-thirty-two-characters",
    userRepository,
  });
  const credentials = await authService.register({
    email: "family@example.com",
    password: "safe-password",
  });
  const api = await startServer({ authService, repository });

  return {
    api,
    directory,
    repository,
    token: credentials.token,
    user: credentials.user,
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

test("requires authentication to create listings", async () => {
  const context = await createAuthenticatedApi();

  try {
    const anonymous = await fetch(`${context.api.baseUrl}/listings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validListing),
    });

    assert.equal(anonymous.status, 401);

    const created = await fetch(`${context.api.baseUrl}/listings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${context.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(validListing),
    });

    assert.equal(created.status, 201);
    const publicListing = (await created.json()).listing;
    assert.equal(publicListing.ownerId, undefined);
    assert.equal(publicListing.status, "pending");

    const storedListings = await context.repository.list({ status: "pending" });
    assert.equal(storedListings[0].ownerId, context.user.id);

    const results = await fetch(
      `${context.api.baseUrl}/listings?city=são%20paulo&type=sell`,
    );

    assert.equal(results.status, 200);
    assert.equal((await results.json()).listings.length, 0);
  } finally {
    await context.api.close();
    await rm(context.directory, { recursive: true, force: true });
  }
});

test("rejects invalid authenticated listing payloads", async () => {
  const context = await createAuthenticatedApi();

  try {
    const response = await fetch(`${context.api.baseUrl}/listings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${context.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...validListing, sealed: false }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual((await response.json()).errors, [
      "listing must describe a sealed package",
    ]);
  } finally {
    await context.api.close();
    await rm(context.directory, { recursive: true, force: true });
  }
});

test("keeps pending listings after creating a new repository instance", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fraldacycle-"));
  const dataFile = join(directory, "listings.json");

  try {
    const firstRepository = new FileListingRepository(dataFile);
    await firstRepository.create(validListing);

    const secondRepository = new FileListingRepository(dataFile);
    const listings = await secondRepository.list({ status: "pending" });

    assert.equal(listings.length, 1);
    assert.equal(listings[0].brand, "FraldaCycle");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("registers and logs in a user", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fraldacycle-"));
  const userRepository = new FileUserRepository(join(directory, "users.json"));
  const authService = new AuthService({
    secret: "a-secret-that-is-longer-than-thirty-two-characters",
    userRepository,
  });
  const api = await startServer({ authService });

  try {
    const registration = await fetch(`${api.baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "FAMILY@EXAMPLE.COM",
        password: "safe-password",
      }),
    });

    assert.equal(registration.status, 201);
    const registered = await registration.json();
    assert.equal(registered.user.email, "family@example.com");
    assert.ok(registered.token);

    const login = await fetch(`${api.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "family@example.com",
        password: "safe-password",
      }),
    });

    assert.equal(login.status, 200);
    assert.ok((await login.json()).token);
  } finally {
    await api.close();
    await rm(directory, { recursive: true, force: true });
  }
});
