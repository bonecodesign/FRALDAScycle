import assert from "node:assert/strict";
import test from "node:test";
import { prepareFreightLinkedPayout } from "../packages/contracts/freight-payout-link.js";

const row = {
  buyer_id: "buyer", product_amount_cents: 10000,
  amount_cents: 12100, platform_fee_cents: 900,
  delivery_fee_cents: 2000, seller_amount_cents: 9200,
  active_quote_id: "quote", active_quote_status: "locked",
  active_quote_shipment_id: null, active_quote_confirmed_by: "buyer",
  active_quote_provider: "fraldacycle_courier",
  active_quote_base_cents: 2000,
  active_quote_platform_fee_cents: 100, active_quote_total_cents: 2100,
  freight_settlement_plan_id: "plan", freight_plan_payer_id: "buyer",
  freight_plan_provider: "fraldacycle_courier",
  freight_provider_amount_cents: 2000,
  freight_plan_platform_fee_cents: 100, freight_plan_total_cents: 2100,
};
test("freight-linked seller and courier amounts preserve product split and surcharge", () => {
  const seller = prepareFreightLinkedPayout(row, "seller");
  const courier = prepareFreightLinkedPayout(row, "courier");
  assert.deepEqual(seller, {
    blockers: [], freightPlanId: "plan", grossProductCents: 10000,
    productPlatformFeeCents: 800, sellerAmountCents: 9200,
  });
  assert.deepEqual(courier, {
    blockers: [], freightPlanId: "plan", freightCents: 2100,
    platformFeeCents: 100, courierAmountCents: 2000,
  });
  assert.equal(seller.grossProductCents + courier.freightCents, row.amount_cents);
  assert.equal(seller.productPlatformFeeCents + courier.platformFeeCents,
    row.platform_fee_cents);
});
test("active freight without plan, mismatch, partner delivery and payment tampering block preparation", () => {
  assert.ok(prepareFreightLinkedPayout({
    ...row, freight_settlement_plan_id: null,
  }, "seller").blockers.includes("freight_plan_required"));
  assert.ok(prepareFreightLinkedPayout({
    ...row, freight_settlement_plan_id: null,
  }, "courier").blockers.includes("freight_plan_required"));
  for (const change of [
    { active_quote_status: "confirmed" },
    { freight_plan_payer_id: "other" },
    { active_quote_platform_fee_cents: 101 },
    { platform_fee_cents: 800 },
    { amount_cents: 12000 },
    { seller_amount_cents: 9100 },
    { delivery_fee_cents: 2100 },
  ]) {
    assert.notEqual(prepareFreightLinkedPayout({ ...row, ...change }, "seller").blockers.length, 0);
  }
  assert.ok(prepareFreightLinkedPayout({
    ...row, active_quote_provider: "lalamove", freight_plan_provider: "lalamove",
  }, "courier").blockers.includes("external_partner_courier_payout_forbidden"));
});
test("legacy product-only and legacy courier preparation remain unchanged without a quote", () => {
  const legacy = {
    active_quote_id: null, freight_settlement_plan_id: null,
    amount_cents: 10000, platform_fee_cents: 800,
    seller_amount_cents: 9200, delivery_fee_cents: 2000,
  };
  const seller = prepareFreightLinkedPayout({...legacy, delivery_fee_cents: 0}, "seller");
  const courier = prepareFreightLinkedPayout(legacy, "courier");
  assert.deepEqual(seller.blockers, []);
  assert.equal(seller.sellerAmountCents, 9200);
  assert.deepEqual(courier.blockers, []);
  assert.equal(courier.freightCents, 2000);
  assert.equal(courier.courierAmountCents, 1900);
});
