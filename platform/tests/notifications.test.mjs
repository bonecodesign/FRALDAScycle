import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationService } from "../apps/api/notifications.js";
import { backoffSeconds, deliverNotification, runNotificationBatch, loadNotificationConfig } from "../workers/notifications.js";

test("notification worker resolves vault credentials before configuring delivery", async () => {
  const env = {
    NODE_ENV: "test",
    SECRETS_PROVIDER_URL: "https://vault.example.test/resolve",
    SECRETS_PROVIDER_TOKEN: "synthetic-token",
    SECRETS_PROVIDER_KEYS: "NOTIFICATION_WEBHOOK_SECRET",
    NOTIFICATION_WEBHOOK_URL: "https://notify.example.test/deliver",
  };
  const config = await loadNotificationConfig(env, {
    async fetchImpl() {
      return Response.json({ secrets: { NOTIFICATION_WEBHOOK_SECRET: "resolved-secret" } });
    },
  });
  let authorization;
  await deliverNotification({ id: "vault-job", payload: {} }, config, async (url, options) => {
    assert.equal(url, env.NOTIFICATION_WEBHOOK_URL);
    authorization = options.headers.authorization;
    return { ok: true };
  });
  assert.equal(authorization, "Bearer resolved-secret");
  assert.equal(env.NOTIFICATION_WEBHOOK_SECRET, undefined);
  await assert.rejects(loadNotificationConfig(env, {
    async fetchImpl() { return new Response(null, { status: 503 }); },
  }), /provider rejected/);
});

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

test("worker retries transport failures without persisting sensitive error details", async () => {
  const failures = [];
  const job = { id: "transport-failure", claim_token: "lease", attempts: 2, payload: {} };
  const repository = {
    async recoverStaleLocks() {},
    async claimBatch() { return [job]; },
    async canDeliver() { return true; },
    async delivered() { assert.fail("Failed delivery must not be acknowledged"); },
    async failed(...args) { failures.push(args); },
  };
  for (const error of [new Error("Bearer secret recipient@example.test token=123456"), "sensitive-string", null]) {
    await runNotificationBatch(repository, {
      notificationWebhookUrl: "https://provider.example/deliver",
      notificationWebhookSecret: "secret",
    }, async () => { throw error; });
  }
  assert.deepEqual(failures, Array.from({ length: 3 }, () => [
    job.id, "Notification provider is unavailable", 30, job.claim_token,
  ]));
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

test('optional reminder respects quiet hours without consuming a retry or contacting a provider', async () => {
  const events = [], job = { id: 'quiet-reminder', kind: 'payment_reminder', preference_user_id: 'user-1', claim_token: 'claim-1', attempts: 1, payload: { channel: 'email' } };
  await runNotificationBatch({
    async recoverStaleLocks() {},
    async claimBatch() { return [job]; },
    async canDeliver() { return true; },
    async operationalPreferences(userId) {
      assert.equal(userId, 'user-1');
      return { configured: true, channels: { email: true }, quietHours: { enabled: true, start: '21:00', end: '08:00', timeZone: 'UTC' } };
    },
    async defer(id, claimToken, seconds) { events.push(['defer', id, claimToken, seconds]); },
    async delivered() { assert.fail('quiet reminder must not be delivered'); },
    async failed() { assert.fail('deferral must not consume retry attempts'); },
  }, {}, async () => { assert.fail('quiet reminder must not contact provider'); }, () => new Date('2026-10-18T23:00:00Z'));
  assert.deepEqual(events, [['defer', 'quiet-reminder', 'claim-1', 900]]);
});

test('optional reminder with a disabled channel is cancelled without provider delivery', async () => {
  const events = [];
  await runNotificationBatch({
    async recoverStaleLocks() {},
    async claimBatch() { return [{ id: 'disabled-reminder', kind: 'general_reminder', preference_user_id: 'user-2', claim_token: 'claim-2', attempts: 1, payload: { channel: 'sms' } }]; },
    async canDeliver() { return true; },
    async operationalPreferences() { return { configured: true, channels: { email: true, sms: false, push: false }, quietHours: { enabled: false } }; },
    async cancelledByPreference(id, claimToken) { events.push([id, claimToken]); },
    async delivered() { assert.fail('disabled channel must not be delivered'); },
    async failed() { assert.fail('preference cancellation is not a retry'); },
  }, {}, async () => { assert.fail('disabled channel must not contact provider'); });
  assert.deepEqual(events, [['disabled-reminder', 'claim-2']]);
});

test('optional reminders are queued only with an approved kind, account, and channel', async () => {
  const queued = [], service = createNotificationService({ async enqueue(input) { queued.push(input); return 'reminder-1'; } });
  assert.deepEqual(await service.reminder({ kind: 'delivery_reminder', userId: 'user-3', email: 'synthetic@example.test', channel: 'email', payload: { message: 'Synthetic reminder' } }), { queued: true, id: 'reminder-1' });
  assert.deepEqual(queued[0], { kind: 'delivery_reminder', userId: 'user-3', recipient: 'synthetic@example.test', payload: { message: 'Synthetic reminder', channel: 'email' } });
  await assert.rejects(service.reminder({ kind: 'security_alert', userId: 'user-3', email: 'synthetic@example.test', channel: 'email' }), /kind is not allowed/);
  await assert.rejects(service.reminder({ kind: 'payment_reminder', email: 'synthetic@example.test', channel: 'email' }), /account and an explicit channel/);
  await assert.rejects(service.reminder({ kind: 'payment_reminder', userId: 'user-3', email: 'synthetic@example.test', channel: 'sms' }), /recipient must match/);
  await assert.rejects(service.reminder({ kind: 'payment_reminder', userId: 'user-3', phone: '31999000000', channel: 'email' }), /recipient must match/);
  await assert.rejects(service.reminder({ kind: 'payment_reminder', userId: 'user-3', email: 'synthetic@example.test', channel: 'push' }), /recipient must match/);
  await assert.rejects(service.reminder({ kind: 'payment_reminder', userId: 'user-3', email: 'synthetic@example.test', channel: 'email', payload: null }), /payload must be an object/);
});
