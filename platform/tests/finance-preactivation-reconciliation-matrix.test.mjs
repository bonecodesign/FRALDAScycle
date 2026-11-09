import assert from "node:assert/strict";
import test from "node:test";
import { externalPartnerDeliveryCharge, saleSplit, exchangeFee } from "../packages/contracts/commercial-rules.js";
import { freightAllocation, freightSettlementReconciliation } from "../packages/contracts/freight-settlement.js";
import { prepareFreightLinkedPayout } from "../packages/contracts/freight-payout-link.js";
import { projectProductProcessingCost } from "../packages/contracts/product-processing-cost.js";

const planId = "11111111-1111-4111-8111-111111111111";
const quoteId = "22222222-2222-4222-8222-222222222222";
const transactionId = "33333333-3333-4333-8333-333333333333";
const payerId = "44444444-4444-4444-8444-444444444444";

function fixture(productCents = 10000, freightCents = 2000) {
  const split = saleSplit(productCents);
  const freight = externalPartnerDeliveryCharge(freightCents);
  const plan = {
    id: planId, delivery_quote_id: quoteId, transaction_id: transactionId,
    payer_id: payerId, provider: "fraldacycle_courier",
    provider_amount_cents: freight.partnerCents,
    platform_fee_cents: freight.platformCents, customer_total_cents: freight.customerTotalCents,
  };
  const quote = {
    id: quoteId, provider: plan.provider, status: "locked", confirmed_by: payerId,
    base_freight_cents: freight.partnerCents,
    platform_fee_cents: freight.platformCents, customer_total_cents: freight.customerTotalCents,
  };
  const transaction = { id: transactionId, kind: "sale", amount_cents: productCents };
  const payment = {
    status: "paid", provider_reference: "synthetic-reconciliation-not-external",
    amount_cents: productCents + freight.customerTotalCents,
    platform_fee_cents: split.platformCents + freight.platformCents,
    delivery_fee_cents: freight.partnerCents, seller_amount_cents: split.sellerCents,
  };
  return { plan, quote, transaction, payment, paidCount: 1 };
}

test("FIN-02/05: sale and freight cent rounding conserves every synthetic cent without unlocking provider payout", () => {
  for (const product of [1, 2, 9, 10, 11, 19, 20, 21, 99, 100, 101, 199, 200, 201, 999, 1000, 10001, 999999]) {
    for (const freight of [1, 2, 9, 10, 11, 19, 20, 21, 99, 100, 101, 999, 2000, 10001]) {
      const input = fixture(product, freight);
      const plan = freightAllocation({
        provider: input.plan.provider, baseFreightCents: freight,
        platformFeeCents: input.plan.platform_fee_cents,
        customerTotalCents: input.plan.customer_total_cents, currency: "BRL",
      });
      assert.equal(plan.providerAmountCents + plan.platformFeeCents, plan.customerTotalCents);
      const payment = input.payment;
      assert.equal(payment.seller_amount_cents + payment.delivery_fee_cents +
        payment.platform_fee_cents, payment.amount_cents,
      "Seller + provider + platform must equal the total captured amount");
      const check = freightSettlementReconciliation(input);
      assert.equal(check.localMatched, true);
      assert.deepEqual(check.blockers, ["external_reconciliation_not_homologated"]);
      assert.equal(check.providerReconciled, false);
      assert.equal(check.payoutAllowed, false);
      assert.equal(check.externalChargeCreated, false);
    }
  }
});

test("FIN-04/07: mutations in provider, quote, payment, cardinality or financial case reject local reconciliation", () => {
  const base = fixture();
  const cases = [
    ["quote status changed", { quote: { ...base.quote, status: "draft" } }, "quote_changed_or_unconfirmed"],
    ["quote provider changed", { quote: { ...base.quote, provider: "lalamove" } }, "quote_changed_or_unconfirmed"],
    ["quote payer changed", { quote: { ...base.quote, confirmed_by: planId } }, "quote_changed_or_unconfirmed"],
    ["quote price changed", { quote: { ...base.quote, customer_total_cents: base.quote.customer_total_cents + 1 } }, "quote_changed_or_unconfirmed"],
    ["plan price drift", { plan: { ...base.plan, customer_total_cents: base.plan.customer_total_cents + 1 } }, "plan_allocation_invalid"],
    ["wrong captured amount", { payment: { ...base.payment, amount_cents: base.payment.amount_cents + 1 } }, "payment_split_mismatch"],
    ["wrong platform commission", { payment: { ...base.payment, platform_fee_cents: base.payment.platform_fee_cents + 1 } }, "payment_split_mismatch"],
    ["wrong seller share", { payment: { ...base.payment, seller_amount_cents: base.payment.seller_amount_cents - 1 } }, "payment_split_mismatch"],
    ["missing provider reference", { payment: { ...base.payment, provider_reference: null } }, "payment_not_confirmed"],
    ["unpaid", { payment: { ...base.payment, status: "initiated" } }, "payment_not_confirmed"],
    ["zero captures", { paidCount: 0 }, "payment_cardinality_invalid"],
    ["duplicate captures", { paidCount: 2 }, "payment_cardinality_invalid"],
    ["finance investigation", { financialCasePending: true }, "financial_case_pending"],
  ];
  for (const [label, change, blocker] of cases) {
    const checked = freightSettlementReconciliation({ ...base, ...change });
    assert.ok(checked.blockers.includes(blocker), label);
    assert.equal(checked.localMatched, false, label);
    assert.equal(checked.payoutAllowed, false, label);
    assert.equal(checked.providerReconciled, false, label);
    assert.equal(checked.externalChargeCreated, false, label);
  }
});

test("FIN-05: two-leg exchanges cannot be treated as a single proven payout; donations are not freights", () => {
  const base = fixture();
  const exchange = freightSettlementReconciliation({
    ...base, transaction: { ...base.transaction, kind: "exchange" },
  });
  assert.equal(exchange.localMatched, false);
  assert.ok(exchange.blockers.includes("exchange_leg_payment_not_configured"));
  assert.equal(exchange.payoutAllowed, false);
  const donation = freightSettlementReconciliation({
    ...base, transaction: { ...base.transaction, kind: "donation" },
  });
  assert.equal(donation.localMatched, false);
  assert.ok(donation.blockers.includes("transaction_invalid"));
  assert.equal(donation.payoutAllowed, false);
  for (const offeredPackage of [1, 20, 100, 999, 10000]) {
    assert.equal(exchangeFee(offeredPackage), Math.round(offeredPackage * 0.025));
  }
});

test("FIN-02/03: unknown processor tariff is never zero, even hypothetical zero is not a provider approval", () => {
  for (const amount of [1, 99, 100, 101, 999, 10000, 999999]) {
    const unknown = projectProductProcessingCost({ productAmountCents: amount });
    assert.equal(unknown.providerProcessingFeeCents, null);
    assert.equal(unknown.sellerAfterProcessingFeeCents, null);
    assert.ok(unknown.blockers.includes("processor_fee_unknown"));
    assert.equal(unknown.payoutAllowed, false);
    const zeroSimulation = projectProductProcessingCost({
      productAmountCents: amount, simulatedProviderFeeCents: 0,
    });
    assert.equal(zeroSimulation.providerProcessingFeeCents, 0);
    assert.equal(zeroSimulation.sellerAfterProcessingFeeCents, saleSplit(amount).sellerCents);
    assert.equal(zeroSimulation.feeHomologated, false);
    assert.equal(zeroSimulation.providerReconciled, false);
    assert.ok(zeroSimulation.blockers.includes("processor_fee_unhomologated"));
    assert.equal(zeroSimulation.payoutAllowed, false);
  }
});

test("FIN-05: local payout preparation does not constitute provider settlement and never pays an external courier as FC courier", () => {
  const { plan, quote, transaction, payment } = fixture();
  const row = {
    active_quote_id: quote.id,
    active_quote_status: quote.status,
    active_quote_confirmed_by: quote.confirmed_by,
    active_quote_provider: quote.provider,
    active_quote_base_cents: quote.base_freight_cents,
    active_quote_platform_fee_cents: quote.platform_fee_cents,
    active_quote_total_cents: quote.customer_total_cents,
    active_quote_shipment_id: null,
    freight_settlement_plan_id: plan.id,
    freight_plan_payer_id: plan.payer_id,
    freight_plan_provider: plan.provider,
    freight_provider_amount_cents: plan.provider_amount_cents,
    freight_plan_platform_fee_cents: plan.platform_fee_cents,
    freight_plan_total_cents: plan.customer_total_cents,
    buyer_id: plan.payer_id,
    product_amount_cents: transaction.amount_cents,
    amount_cents: payment.amount_cents,
    platform_fee_cents: payment.platform_fee_cents,
    delivery_fee_cents: payment.delivery_fee_cents,
    seller_amount_cents: payment.seller_amount_cents,
  };
  const seller = prepareFreightLinkedPayout(row, "seller");
  const courier = prepareFreightLinkedPayout(row, "courier");
  assert.deepEqual(seller.blockers, []);
  assert.deepEqual(courier.blockers, []);
  assert.equal(seller.sellerAmountCents + courier.courierAmountCents +
    seller.productPlatformFeeCents + courier.platformFeeCents, row.amount_cents);
  const external = prepareFreightLinkedPayout({
    ...row, freight_plan_provider: "lalamove", active_quote_provider: "lalamove",
  }, "courier");
  assert.ok(external.blockers.includes("external_partner_courier_payout_forbidden"));
  const checked = freightSettlementReconciliation({ plan, quote, transaction, payment, paidCount: 1 });
  assert.equal(checked.payoutAllowed, false,
    "Local payout preparation must never authorize a real disbursement");
});
