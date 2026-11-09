import assert from "node:assert/strict";
import test from "node:test";
import { deliverNotification, notificationPayloadForDispatch } from "../workers/notifications.js";

const config = {
  notificationWebhookUrl: "https://synthetic-notify.example.test",
  notificationWebhookSecret: "synthetic-not-a-real-secret",
};
const address = "family-owner@example.test";
const events = ["child_profile_age_limit_warning", "child_profile_age_limit_closed"];

test("child age notifications whitelist channel and event before external dispatch, including legacy queued data", async () => {
  for (const event of events) {
    const job = {
      id: "synthetic-child-lifecycle-job",
      kind: "account_lifecycle_notice",
      recipient: address,
      payload: {
        channel: "email", event, emoji: "🍼",
        birthDate: "2013-10-23", childProfileId: "synthetic-child-profile",
        analytics: { child: { birthDate: "2013-10-23" } },
      },
    };
    let calls = 0;
    await deliverNotification(job, config, async (_url, options) => {
      calls++;
      const body = JSON.parse(options.body);
      assert.deepEqual(body.payload, { channel: "email", event });
      assert.equal(body.kind, "account_lifecycle_notice");
      assert.equal(body.recipient, address);
      assert.doesNotMatch(options.body, /emoji|birthDate|childProfileId|analytics|2013-10-23|🍼/i);
      return { ok: true, status: 200 };
    });
    assert.equal(calls, 1);
    assert.ok(Object.hasOwn(job.payload, "emoji"),
      "Filtering must not corrupt the historical original for audit or replay");
  }
});

test("unexpected child lifecycle events and delivery channels fail closed, without a provider request", async () => {
  for (const payload of [
    { channel: "sms", event: "child_profile_age_limit_closed", emoji: "⭐" },
    { channel: "email", event: "child_profile_unknown", emoji: "🧸" },
    { channel: "email", emoji: "🍼", birthDate: "2013-10-23" },
    null,
  ]) {
    assert.throws(
      () => notificationPayloadForDispatch({ kind: "account_lifecycle_notice", payload }),
      /not supported/,
    );
    let calls = 0;
    await assert.rejects(
      deliverNotification({
        id: "rejected-child-job", kind: "account_lifecycle_notice",
        recipient: address, payload,
      }, config, async () => { calls++; return { ok: true, status: 200 }; }),
      /not supported/,
    );
    assert.equal(calls, 0);
  }
});

test("notification minimization does not rewrite unrelated account messages", () => {
  const other = {
    kind: "payment_reminder",
    payload: { channel: "email", message: "Lembrete de pagamento sintético" },
  };
  assert.deepEqual(notificationPayloadForDispatch(other), other.payload);
});
