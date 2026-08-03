import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationService } from "../apps/api/notifications.js";
import { backoffSeconds, deliverNotification, runNotificationBatch } from "../workers/notifications.js";

test("identity notifications are queued without exposing provider details", async () => {
  const queued = [];
  const service = createNotificationService({
    async enqueue(message) { queued.push(message); return "job-1"; },
  });
  assert.deepEqual(
    await service.verification({ email: "ana@example.com", token: "123456" }),
    { queued: true, id: "job-1" },
  );
  assert.deepEqual(queued[0], {
    kind: "email_verification",
    recipient: "ana@example.com",
    payload: { token: "123456", channel: "email" },
  });
});

test("notification delivery uses HTTPS contract, authentication and idempotency", async () => {
  const calls = [];
  await deliverNotification(
    { id: "job-1", kind: "email_verification", recipient: "ana@example.com", payload: { token: "123456" } },
    { notificationWebhookUrl: "https://provider.example/deliver", notificationWebhookSecret: "secret" },
    async (url, options) => { calls.push([url, options]); return { ok: true, status: 202 }; },
  );
  assert.equal(calls[0][0], "https://provider.example/deliver");
  assert.equal(calls[0][1].headers.authorization, "Bearer secret");
  assert.equal(calls[0][1].headers["idempotency-key"], "job-1");
});

test("worker retries failures with bounded exponential backoff", async () => {
  const events = [];
  const repository = {
    async recoverStaleLocks() { events.push("recover"); },
    async claimBatch() { return [{ id: "job-2", attempts: 3, kind: "password_recovery", recipient: "31999000000", payload: {} }]; },
    async delivered(id) { events.push(["delivered", id]); },
    async failed(id, message, delay) { events.push(["failed", id, message, delay]); },
  };
  const count = await runNotificationBatch(
    repository,
    { notificationWebhookUrl: "https://provider.example/deliver", notificationWebhookSecret: "secret" },
    async () => ({ ok: false, status: 503 }),
  );
  assert.equal(count, 1);
  assert.deepEqual(events.at(-1), ["failed", "job-2", "Notification provider returned 503", 60]);
  assert.equal(backoffSeconds(20), 3600);
});

test("worker marks successful jobs as delivered", async () => {
  const events = [];
  const repository = {
    async recoverStaleLocks() {},
    async claimBatch() { return [{ id: "job-3", attempts: 1, kind: "email_verification", recipient: "a@b.com", payload: {} }]; },
    async delivered(id) { events.push(id); },
    async failed() { throw new Error("must not fail"); },
  };
  await runNotificationBatch(
    repository,
    { notificationWebhookUrl: "https://provider.example/deliver", notificationWebhookSecret: "secret" },
    async () => ({ ok: true, status: 202 }),
  );
  assert.deepEqual(events, ["job-3"]);
});
