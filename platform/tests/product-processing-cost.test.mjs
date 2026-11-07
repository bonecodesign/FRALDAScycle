import assert from "node:assert/strict";
import test from "node:test";
import {projectProductProcessingCost} from "../packages/contracts/product-processing-cost.js";
import {createPaymentService} from "../apps/api/payment-service.js";

test("requirement 3: unknown processing tariff is not zero and no seller net is promised", () => {
  const result=projectProductProcessingCost({productAmountCents:10000});
  assert.equal(result.buyerProductAmountCents,10000);
  assert.equal(result.platformProductFeeCents,800);
  assert.equal(result.sellerBeforeProcessingFeeCents,9200);
  assert.equal(result.providerProcessingFeeCents,null);
  assert.equal(result.sellerAfterProcessingFeeCents,null);
  assert.equal(result.processingFeePayer,"seller");
  assert.equal(result.payoutAllowed,false);
  assert.ok(result.blockers.includes("processor_fee_unknown"));
});

test("requirement 3: explicit hypothetical tariff is fully charged against seller net, not buyer or platform", () => {
  for (const fee of [0,1,135,9200]) {
    const result=projectProductProcessingCost({productAmountCents:10000,simulatedProviderFeeCents:fee});
    assert.equal(result.sellerAfterProcessingFeeCents,9200-fee);
    assert.equal(result.platformProductFeeCents,800);
    assert.equal(result.buyerProductAmountCents,10000);
    assert.equal(result.simulationOnly,true);
    assert.equal(result.feeHomologated,false);
    assert.equal(result.payoutAllowed,false);
    assert.ok(result.blockers.includes("processor_fee_unhomologated"));
  }
});

test("requirement 3: fee exceeding seller share cannot become a negative payout", () => {
  const result=projectProductProcessingCost({productAmountCents:10000,simulatedProviderFeeCents:9201});
  assert.equal(result.sellerAfterProcessingFeeCents,null);
  assert.ok(result.blockers.includes("seller_margin_insufficient"));
  for (const value of [-1,0,1.25,2147483648,Number.MAX_SAFE_INTEGER+1]) {
    assert.throws(()=>projectProductProcessingCost({productAmountCents:value}),RangeError);
  }
  for (const value of [-1,0.5,NaN,Infinity]) {
    assert.throws(()=>projectProductProcessingCost({productAmountCents:10000,simulatedProviderFeeCents:value}),RangeError);
  }
});

test("requirement 3: checkout preview exposes unknown provider tariff without triggering a charge",async()=>{
  let charged=0;
  const service=createPaymentService({
    async checkoutPreview(){return {id:"11111111-1111-4111-8111-111111111111",
      status:"initiated",amount_cents:10000,kind:"sale",quote_id:null};},
  },{async createIntent(){charged++;}});
  const preview=await service.checkoutPreview("buyer","11111111-1111-4111-8111-111111111111");
  assert.equal(preview.providerProcessingFeeCents,null);
  assert.equal(preview.sellerAfterProcessingFeeCents,null);
  assert.equal(preview.processingFeePayer,"seller");
  assert.equal(preview.processorFeeHomologated,false);
  assert.equal(preview.externalChargeCreated,false);
  assert.equal(charged,0);
});
