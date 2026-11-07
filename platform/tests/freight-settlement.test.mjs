import assert from "node:assert/strict";
import test from "node:test";
import { freightAllocation, freightSettlementReconciliation } from "../packages/contracts/freight-settlement.js";
import { createFreightSettlementService } from "../apps/api/freight-settlement-service.js";

const user = { id: "11111111-1111-4111-8111-111111111111", role: "admin", staffSector: "finance", staffAccessLevel: 3 };
const quoteId = "22222222-2222-4222-8222-222222222222";
const planId = "33333333-3333-4333-8333-333333333333";
const transactionId = "44444444-4444-4444-8444-444444444444";
const plan = {
  id: planId, delivery_quote_id: quoteId, transaction_id: transactionId,
  shipment_id: null, payer_id: "buyer", provider: "lalamove",
  provider_amount_cents: 2000, platform_fee_cents: 100, customer_total_cents: 2100,
  currency: "BRL", prepared_at: new Date("2030-01-01T00:00:00Z"),
};
const confirmed = {
  id: quoteId, status: "locked", confirmed_by: "buyer", provider: "lalamove",
  base_freight_cents: 2000, platform_fee_cents: 100, customer_total_cents: 2100,
};
const transaction = { id: transactionId, kind: "sale", amount_cents: 10000 };
const paid = {
  status: "paid", provider_reference: "local-only-fixture", amount_cents: 12100,
  platform_fee_cents: 900, delivery_fee_cents: 2000, seller_amount_cents: 9200,
};
test("freight plan preserves base plus five percent without deducting commission from courier", () => {
  const result = freightAllocation({
    provider: "fraldacycle_courier", baseFreightCents: 2000,
    platformFeeCents: 100, customerTotalCents: 2100, currency: "BRL",
  });
  assert.deepEqual(result, {
    providerAmountCents: 2000, platformFeeCents: 100, customerTotalCents: 2100,
  });
  assert.throws(() => freightAllocation({
    provider: "lalamove", baseFreightCents: 2000,
    platformFeeCents: 100, customerTotalCents: 2000, currency: "BRL",
  }), /mismatch/);
});
test("matching local split never permits external payout; disputes, duplicate paid intents and wrong amounts block", () => {
  const input = { plan, quote: confirmed, transaction, payment: paid, paidCount: 1 };
  const good = freightSettlementReconciliation(input);
  assert.equal(good.localMatched, true);
  assert.equal(good.payoutAllowed, false);
  assert.equal(good.providerReconciled, false);
  assert.deepEqual(good.blockers, ["external_reconciliation_not_homologated"]);
  const mismatched = freightSettlementReconciliation({
    ...input, payment: { ...paid, delivery_fee_cents: 1900 },
  });
  assert.equal(mismatched.localMatched, false);
  assert.ok(mismatched.blockers.includes("payment_split_mismatch"));
  assert.ok(freightSettlementReconciliation({ ...input, paidCount: 2 }).blockers.includes("payment_cardinality_invalid"));
  assert.ok(freightSettlementReconciliation({ ...input, financialCasePending: true }).blockers.includes("financial_case_pending"));
  assert.ok(freightSettlementReconciliation({ ...input, quote: { ...confirmed, status: "superseded" } }).blockers.includes("quote_changed_or_unconfirmed"));
  assert.ok(freightSettlementReconciliation({ ...input, payment: null, paidCount: 0 }).blockers.includes("payment_not_confirmed"));
  assert.ok(freightSettlementReconciliation({
    ...input, transaction: { ...transaction, kind: "exchange" },
  }).blockers.includes("exchange_leg_payment_not_configured"));
});
test("finance only may prepare and read local plans, with no payout action", async () => {
  const events = [];
  const service = createFreightSettlementService({
    prepare: async input => (events.push(input), { plan, reused: false }),
    context: async () => ({
      ...plan, current_quote_id: quoteId, quote_status: "locked",
      quote_confirmed_by: "buyer", quote_provider: "lalamove",
      quote_base_freight_cents: 2000, quote_platform_fee_cents: 100, quote_total_cents: 2100,
      current_transaction_id: transactionId, product_amount_cents: 10000, kind: "sale",
      payment_id: "55555555-5555-4555-8555-555555555555",
      payment_status: "paid", payment_provider_reference: "fixture",
      payment_amount_cents: 12100, payment_platform_fee_cents: 900,
      payment_delivery_fee_cents: 2000, payment_seller_amount_cents: 9200,
      paid_count: 1, financial_case_pending: false,
    }),
  });
  for (const actor of [
    { ...user, staffSector: "operations" }, { ...user, staffAccessLevel: 2 },
    { ...user, role: "customer" },
  ]) {
    await assert.rejects(service.prepare(actor, { quoteId, confirmed: true }));
  }
  await assert.rejects(service.prepare(user, { quoteId, confirmed: false }));
  const prepared = await service.prepare(user, { quoteId, confirmed: true });
  assert.equal(prepared.plan.providerAmountCents, 2000);
  assert.equal(prepared.plan.executionAllowed, false);
  assert.equal(events.length, 1);
  const reviewed = await service.reconcileLocal(user, planId);
  assert.equal(reviewed.reconciliation.localMatched, true);
  assert.equal(reviewed.reconciliation.payoutAllowed, false);
});
