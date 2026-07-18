import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AuthService } from "./auth-service.js";
import { createApi } from "./app.js";
import { FileListingRepository } from "./file-listing-repository.js";
import { FileNotificationRepository } from "./file-notification-repository.js";
import { FileUserRepository } from "./file-user-repository.js";
import { NotificationService } from "./notification-service.js";

test("notifies an owner when a moderator approves a listing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fraldacycle-"));
  const users = new FileUserRepository(join(directory, "users.json"));
  const auth = new AuthService({
    secret: "a-secret-that-is-longer-than-thirty-two-characters",
    userRepository: users,
  });
  const owner = await auth.register({ email: "owner@example.com", password: "safe-password" });
  const moderator = await auth.register({ email: "moderator@example.com", password: "safe-password" });
  const notifications = new NotificationService({
    repository: new FileNotificationRepository(join(directory, "notifications.json")),
  });
  const server = createApi({
    authService: auth,
    moderatorEmails: ["moderator@example.com"],
    notificationService: notifications,
    repository: new FileListingRepository(join(directory, "listings.json")),
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const created = await fetch(`${baseUrl}/listings`, {
      method: "POST",
      headers: { authorization: `Bearer ${owner.token}`, "content-type": "application/json" },
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

    await fetch(`${baseUrl}/moderation/listings/${listing.id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${moderator.token}`, "content-type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });

    const response = await fetch(`${baseUrl}/my/notifications`, {
      headers: { authorization: `Bearer ${owner.token}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.notifications.length, 1);
    assert.equal(body.notifications[0].type, "listing.active");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
