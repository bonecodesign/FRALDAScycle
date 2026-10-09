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
    async canDeliver() { return true; },
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
    async canDeliver() { return true; },
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

test('worker cancels obsolete authentication codes before contacting the provider', async () => {
  const cancelled = [];
  await runNotificationBatch({
    async recoverStaleLocks() {},
    async claimBatch() { return [{ id: 'obsolete', attempts: 1 }]; },
    async canDeliver() { return false; },
    async cancelled(id) { cancelled.push(id); },
    async delivered() { assert.fail('must not be delivered'); },
    async failed() { assert.fail('must not retry obsolete code'); },
  }, {}, async () => { assert.fail('must not contact provider'); });
  assert.deepEqual(cancelled, ['obsolete']);
});

test('worker fails closed if authentication-code eligibility cannot be read', async () => {
  const failures = [];
  await runNotificationBatch({
    async recoverStaleLocks() {},
    async claimBatch() { return [{ id: 'unavailable', attempts: 1 }]; },
    async canDeliver() { throw new Error('database temporarily unavailable'); },
    async failed(id, error, delay) { failures.push([id, error, delay]); },
  }, {}, async () => { assert.fail('must not contact provider'); });
  assert.deepEqual(failures, [['unavailable', 'database temporarily unavailable', 15]]);
});

test('notification service forwards token binding only to the queue repository', async () => {
  const hash = Buffer.alloc(32, 1), queued = [];
  const service = createNotificationService({ async enqueue(input) { queued.push(input); return null; } });
  assert.deepEqual(await service.passwordRecovery({ email: 'synthetic@example.test', token: '123456', authTokenHash: hash }), { queued: false });
  assert.equal(queued[0].authTokenHash, hash);
  assert.deepEqual(queued[0].payload, { token: '123456', channel: 'email' });
});

test('worker carries the claim token through eligibility and delivery updates', async () => {
  const events = [], job = { id: 'leased', claim_token: 'lease-one', attempts: 1, payload: { token: '123456' } };
  await runNotificationBatch({
    async recoverStaleLocks() {},
    async claimBatch() { return [job]; },
    async canDeliver(id, claimToken) { events.push(['eligible', id, claimToken]); return true; },
    async delivered(id, claimToken) { events.push(['delivered', id, claimToken]); },
    async failed() { assert.fail('must not fail'); },
  }, { notificationWebhookUrl: 'https://synthetic.example.test', notificationWebhookSecret: 'synthetic' }, async () => ({ ok: true }));
  assert.deepEqual(events, [['eligible', 'leased', 'lease-one'], ['delivered', 'leased', 'lease-one']]);
});
