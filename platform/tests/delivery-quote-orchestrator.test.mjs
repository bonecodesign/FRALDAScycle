import assert from "node:assert/strict";
import test from "node:test";
import { createDeliveryQuoteOrchestrator } from "../packages/contracts/delivery-quote-orchestrator.js";

const now = Date.parse("2030-01-01T12:00:00Z");
const quote = (provider) => ({ available: true, quote: {
  provider, quoteId: `${provider}-quote-1`, customerTotalCents: 1_890,
  currency: "BRL", expiresAt: "2030-01-01T12:05:00Z",
} });

test("quote orchestration preserves Lalamove then closest eligible platform courier", async () => {
  const calls = [];
  const orchestrator = createDeliveryQuoteOrchestrator({ now: () => now, quoters: {
    lalamove: async () => { calls.push("lalamove"); return { available: false, reason: "outside_coverage" }; },
    fraldacycle_courier: async () => { calls.push("fraldacycle_courier"); return quote("fraldacycle_courier"); },
    loggi_express: async () => { calls.push("loggi_express"); return quote("loggi_express"); },
  } });
  const result = await orchestrator.quote({ routeId: "route-1" });
  assert.equal(result.selected, "fraldacycle_courier");
  assert.deepEqual(calls, ["lalamove", "fraldacycle_courier"]);
  assert.equal(result.payerConfirmationRequired, true);
  assert.equal(result.automaticSwitchAllowed, false);
});

test("Loggi and Uber are attempted only after the approved primary options", async () => {
  const calls = [];
  const unavailable = (provider) => async () => {
    calls.push(provider); return { available: false, reason: "temporarily_unavailable" };
  };
  const orchestrator = createDeliveryQuoteOrchestrator({ now: () => now, quoters: {
    lalamove: unavailable("lalamove"),
    fraldacycle_courier: unavailable("fraldacycle_courier"),
    loggi_express: unavailable("loggi_express"),
    uber_direct: async () => { calls.push("uber_direct"); return quote("uber_direct"); },
  } });
  assert.equal((await orchestrator.quote({})).selected, "uber_direct");
  assert.deepEqual(calls, ["lalamove", "fraldacycle_courier", "loggi_express", "uber_direct"]);
});

test("a processed payment blocks requote and requires support without calling providers", async () => {
  let calls = 0;
  const orchestrator = createDeliveryQuoteOrchestrator({ now: () => now, quoters: {
    lalamove: async () => { calls++; return quote("lalamove"); },
  } });
  const result = await orchestrator.quote({}, { paymentProcessed: true });
  assert.equal(calls, 0);
  assert.equal(result.blocker, "paid_transaction_locked");
  assert.equal(result.supportRequired, true);
  assert.equal(result.automaticSwitchAllowed, false);
});

test("invalid successful quotes fail closed instead of silently changing provider", async () => {
  let fallbackCalls = 0;
  const orchestrator = createDeliveryQuoteOrchestrator({ now: () => now, quoters: {
    lalamove: async () => ({ available: true, quote: { ...quote("lalamove").quote, currency: "USD" } }),
    fraldacycle_courier: async () => { fallbackCalls++; return quote("fraldacycle_courier"); },
  } });
  await assert.rejects(orchestrator.quote({}), /Invalid lalamove delivery quote/);
  assert.equal(fallbackCalls, 0);
});
