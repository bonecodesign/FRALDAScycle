import assert from "node:assert/strict";
import test from "node:test";
import {exchangeFreightLegReadiness} from "../packages/contracts/exchange-freight-readiness.js";
import {createFreightSettlementService} from "../apps/api/freight-settlement-service.js";

const transaction="11111111-1111-4111-8111-111111111111";
const buyer="22222222-2222-4222-8222-222222222222";
const seller="33333333-3333-4333-8333-333333333333";
const finance={id:"44444444-4444-4444-8444-444444444444",role:"admin",staffSector:"finance",staffAccessLevel:3};
const future="2030-06-01T00:00:00.000Z";
const now=Date.parse("2026-11-07T12:00:00.000Z");

function leg(index,base,recipient,sender) {
  const shipmentId=`aaaaaaa${index}-aaaa-4aaa-8aaa-aaaaaaaaaaa${index}`;
  const quoteId=`bbbbbbb${index}-bbbb-4bbb-8bbb-bbbbbbbbbbb${index}`;
  const planId=`ccccccc${index}-cccc-4ccc-8ccc-ccccccccccc${index}`;
  const fee=Math.floor((base*500+5000)/10000);
  return {
    exchange_leg:index,shipment_id:shipmentId,shipment_transaction_id:transaction,
    shipment_recipient_id:recipient,shipment_sender_id:sender,shipment_payer_id:recipient,
    quote_id:quoteId,quote_shipment_id:shipmentId,quote_transaction_id:transaction,
    quote_status:"confirmed",quote_confirmed_by:recipient,quote_provider:"lalamove",
    quote_currency:"BRL",quote_expires_at:future,quote_base_cents:base,
    quote_platform_fee_cents:fee,quote_total_cents:base+fee,
    plan_id:planId,plan_quote_id:quoteId,plan_transaction_id:transaction,
    plan_shipment_id:shipmentId,plan_payer_id:recipient,plan_provider:"lalamove",
    plan_provider_amount_cents:base,plan_platform_fee_cents:fee,
    plan_total_cents:base+fee,
  };
}
const rows=()=>[leg(1,2000,seller,buyer),leg(2,3000,buyer,seller)];
const preview=(items)=>exchangeFreightLegReadiness({transactionId:transaction,buyerId:buyer,sellerId:seller,rows:items,now});

test("requirement 9: two separately paid legs keep individual payers and 5% without enabling charges",()=>{
  const result=preview(rows());
  assert.equal(result.localReady,true);
  assert.deepEqual(result.legs.map(x=>x.payerTotalCents),[2100,3150]);
  assert.deepEqual(result.legs.map(x=>x.platformFeeCents),[100,150]);
  assert.deepEqual(result.legs.map(x=>x.payerId),[seller,buyer]);
  assert.deepEqual(result.totals,{
    providerAmountCents:5000,platformFeeCents:250,combinedForAccountingOnlyCents:5250,
  });
  assert.equal(result.payoutAllowed,false);
  assert.equal(result.externalChargeCreated,false);
  assert.equal(result.providerReconciled,false);
  assert.deepEqual(result.blockers,["exchange_leg_payment_not_configured","external_reconciliation_not_homologated"]);
});

test("requirement 9: missing, cross-paid, expired, changed and duplicated legs fail closed",()=>{
  const base=rows();
  const tests=[
    [base.slice(0,1),"exchange_leg_missing_or_duplicated"],
    [[base[0],{...base[1],shipment_payer_id:seller}],"exchange_leg_payer_invalid"],
    [[base[0],{...base[1],quote_confirmed_by:seller}],"exchange_leg_quote_not_confirmed"],
    [[base[0],{...base[1],quote_expires_at:"2026-01-01T00:00:00Z"}],"exchange_leg_quote_not_confirmed"],
    [[base[0],{...base[1],quote_platform_fee_cents:140}],"exchange_leg_quote_amount_invalid"],
    [[base[0],{...base[1],plan_payer_id:seller}],"exchange_leg_plan_mismatch"],
    [[base[0],{...base[1],plan_id:null}],"exchange_leg_plan_missing"],
    [[base[0],{...base[1],quote_id:null}],"exchange_leg_quote_missing"],
    [[base[0],{...base[1],shipment_id:base[0].shipment_id}],"exchange_shipment_not_independent"],
  ];
  for(const [input,blocker] of tests){
    const result=preview(input);
    assert.equal(result.localReady,false,blocker);
    assert.equal(result.totals,null,blocker);
    assert.equal(result.payoutAllowed,false,blocker);
    assert.ok(result.legs.some(x=>x.blockers.includes(blocker))
      ||result.globalBlockers.includes(blocker),blocker);
  }
});

test("requirement 9: finance-only service exposes no cross-customer checkout",async()=>{
  const service=createFreightSettlementService({
    async exchangeLegs(){return {buyerId:buyer,sellerId:seller,rows:rows()};},
  });
  const summary=await service.exchangeFreightSummary(finance,transaction);
  assert.equal(summary.localReady,true);
  await assert.rejects(service.exchangeFreightSummary({...finance,staffSector:"operations"},transaction),{code:"forbidden"});
  await assert.rejects(service.exchangeFreightSummary({id:buyer,role:"customer"},transaction),{code:"forbidden"});
  await assert.rejects(service.exchangeFreightSummary(finance,"not-a-uuid"),{code:"invalid_freight_settlement_id"});
});
