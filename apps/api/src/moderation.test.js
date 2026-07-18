import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AuthService } from "./auth-service.js";
import { createApi } from "./app.js";
import { FileListingRepository } from "./file-listing-repository.js";
import { FileUserRepository } from "./file-user-repository.js";

test("allows only moderators to activate pending listings", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fraldacycle-"));
  const users = new FileUserRepository(join(directory, "users.json"));
  const repository = new FileListingRepository(join(directory, "listings.json"));
  const auth = new AuthService({
    secret: "a-secret-that-is-longer-than-thirty-two-characters",
    userRepository: users,
  });
  const moderator = await auth.register({
    email: "moderator@example.com",
    password: "safe-password",
  });
  const member = await auth.register({
    email: "member@example.com",
    password: "safe-password",
  });
  const server = createApi({
    authService: auth,
    moderatorEmails: ["moderator@example.com"],
    repository,
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const created = await fetch(`${baseUrl}/listings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${member.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "donate",
        sealed: true,
        brand: "FraldaCycle",
        diaperSize: "M",
        units: 20,
        location: { city: "São Paulo", state: "SP" },
      }),
    });
    const listing = (await created.json()).listing;

    const denied = await fetch(`${baseUrl}/moderation/listings/${listing.id}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${member.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ status: "active" }),
    });
    assert.equal(denied.status, 403);

    const approved = await fetch(`${baseUrl}/moderation/listings/${listing.id}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${moderator.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ status: "active" }),
    });
    assert.equal(approved.status, 200);
    assert.equal((await approved.json()).listing.status, "active");

    const publicListings = await fetch(`${baseUrl}/listings`);
    assert.equal((await publicListings.json()).listings.length, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
