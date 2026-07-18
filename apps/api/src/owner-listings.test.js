import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AuthService } from "./auth-service.js";
import { createApi } from "./app.js";
import { FileListingRepository } from "./file-listing-repository.js";
import { FileUserRepository } from "./file-user-repository.js";

const listing = {
  type: "donate",
  sealed: true,
  brand: "FraldaCycle",
  diaperSize: "M",
  units: 30,
  location: { city: "São Paulo", state: "SP" },
};

test("lists and deletes only the authenticated user's listings", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fraldacycle-"));
  const userRepository = new FileUserRepository(join(directory, "users.json"));
  const repository = new FileListingRepository(join(directory, "listings.json"));
  const authService = new AuthService({
    secret: "a-secret-that-is-longer-than-thirty-two-characters",
    userRepository,
  });
  const owner = await authService.register({
    email: "owner@example.com",
    password: "safe-password",
  });
  const otherUser = await authService.register({
    email: "other@example.com",
    password: "safe-password",
  });
  const server = createApi({ authService, repository });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const created = await fetch(`${baseUrl}/listings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${owner.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(listing),
    });

    assert.equal(created.status, 201);
    const createdListing = (await created.json()).listing;

    const mine = await fetch(`${baseUrl}/my/listings`, {
      headers: { authorization: `Bearer ${owner.token}` },
    });

    assert.equal(mine.status, 200);
    assert.equal((await mine.json()).listings.length, 1);

    const forbiddenDelete = await fetch(
      `${baseUrl}/listings/${createdListing.id}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${otherUser.token}` },
      },
    );

    assert.equal(forbiddenDelete.status, 404);

    const deleted = await fetch(`${baseUrl}/listings/${createdListing.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${owner.token}` },
    });

    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), { deleted: true });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
});
