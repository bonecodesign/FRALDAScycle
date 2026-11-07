import assert from "node:assert/strict";
import test from "node:test";
import { externalPartnerDeliveryCharge, saleSplit } from "../packages/contracts/commercial-rules.js";
import { freightAllocation, freightSettlementReconciliation } from "../packages/contracts/freight-settlement.js";
import { prepareFreightLinkedPayout } from "../packages/contracts/freight-payout-link.js";

const id="11111111-1111-4111-8111-111111111111";
const payer="22222222-2222-4222-8222-222222222222";

test("requirement 2: 5% freight fee preserves provider base across rounding boundaries",()=>{
  for(const base of [1,2,9,10,11,19,20,21,99,100,101,199,200,201,999,1000,2000,10001,999999]){
    const calculated=externalPartnerDeliveryCharge(base);
    const allocation=freightAllocation({
      provider:"lalamove",baseFreightCents:base,platformFeeCents:calculated.platformCents,
      customerTotalCents:calculated.customerTotalCents,currency:"BRL",
    });
    assert.equal(allocation.providerAmountCents,base);
    assert.equal(allocation.platformFeeCents,calculated.platformCents);
    assert.equal(allocation.customerTotalCents,base+calculated.platformCents);
    assert.equal(calculated.platformCents,Math.round(base*0.05));
  }
});

test("requirement 2: product, partner and platform shares conserve buyer payment without external settlement",()=>{
  const product=10000,base=2000,fee=100,total=2100;
  const split=saleSplit(product);
  const row={
    active_quote_id:id,active_quote_status:"locked",active_quote_confirmed_by:payer,
    active_quote_provider:"fraldacycle_courier",active_quote_base_cents:base,
    active_quote_platform_fee_cents:fee,active_quote_total_cents:total,
    active_quote_shipment_id:null,freight_settlement_plan_id:id,
    freight_plan_payer_id:payer,freight_plan_provider:"fraldacycle_courier",
    freight_provider_amount_cents:base,freight_plan_platform_fee_cents:fee,
    freight_plan_total_cents:total,buyer_id:payer,product_amount_cents:product,
    amount_cents:product+total,platform_fee_cents:split.platformCents+fee,
    delivery_fee_cents:base,seller_amount_cents:split.sellerCents,
  };
  const seller=prepareFreightLinkedPayout(row,"seller");
  const courier=prepareFreightLinkedPayout(row,"courier");
  assert.deepEqual(seller.blockers,[]);
  assert.deepEqual(courier.blockers,[]);
  assert.equal(seller.sellerAmountCents+courier.courierAmountCents
    +seller.productPlatformFeeCents+courier.platformFeeCents,row.amount_cents);
  assert.equal(courier.courierAmountCents,base);
  assert.equal(courier.platformFeeCents,fee);
  const plan={id,delivery_quote_id:id,transaction_id:id,payer_id:payer,
    provider:"fraldacycle_courier",provider_amount_cents:base,
    platform_fee_cents:fee,customer_total_cents:total};
  const reconciliation=freightSettlementReconciliation({
    plan,quote:{id,status:"locked",confirmed_by:payer,provider:plan.provider,
      base_freight_cents:base,platform_fee_cents:fee,customer_total_cents:total},
    transaction:{id,kind:"sale",amount_cents:product},
    payment:{status:"paid",provider_reference:"synthetic-no-external-charge",
      amount_cents:row.amount_cents,platform_fee_cents:row.platform_fee_cents,
      delivery_fee_cents:base,seller_amount_cents:row.seller_amount_cents},
    paidCount:1,
  });
  assert.equal(reconciliation.localMatched,true);
  assert.equal(reconciliation.providerReconciled,false);
  assert.equal(reconciliation.payoutAllowed,false);
  assert.deepEqual(reconciliation.blockers,["external_reconciliation_not_homologated"]);
  assert.deepEqual(prepareFreightLinkedPayout({...row,freight_plan_provider:"lalamove",
    active_quote_provider:"lalamove"},"courier").blockers,["external_partner_courier_payout_forbidden"]);
});
