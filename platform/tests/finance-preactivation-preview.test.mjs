import assert from 'node:assert/strict';
import test from 'node:test';
import {previewSaleFinances,previewExchangeFinances,previewInstitutionalDonationFinances} from '../packages/contracts/finance-preactivation-preview.js';
import {saleSplit,exchangeFee,externalPartnerDeliveryCharge} from '../packages/contracts/commercial-rules.js';

test('FC-305: R$100 sale + R$20 freight preserves 8% product and 5% freight fee without invented processor price',()=>{
  const result=previewSaleFinances({productCents:10000,freightBaseCents:2000});
  assert.equal(result.operation,'sale');
  assert.equal(result.buyerProductCents,10000);
  assert.equal(result.buyerFreightCents,2100);
  assert.equal(result.buyerTotalCents,12100);
  assert.equal(result.productCommissionCents,800);
  assert.equal(result.freightCommissionCents,100);
  assert.equal(result.platformCommissionCents,900);
  assert.equal(result.partnerFreightCents,2000);
  assert.equal(result.sellerBeforeProcessingCents,9200);
  assert.equal(result.productProcessingFeePayer,'seller');
  assert.equal(result.processorFeeCents,null);
  assert.equal(result.sellerAfterProcessingCents,null);
  assert.equal(result.freightResponsibility,'buyer');
  assert.equal(result.buyerTotalCents,result.platformCommissionCents+result.sellerBeforeProcessingCents+result.partnerFreightCents);
  assert.equal(result.payoutAllowed,false);
  assert.equal(result.providerReconciled,false);
  assert.equal(result.externalChargeCreated,false);
  assert.equal(result.launchAuthorized,false);
  assert.ok(result.blockers.includes('processor_fee_unknown'));
});

test('FC-305: sale cent conservation and unknown external fees survive odd amounts',()=>{
  for(const productCents of [1,2,3,9,10,11,19,21,99,101,5555,99999]){
    for(const freightBaseCents of [1,2,3,9,10,11,19,21,99,101,1200]){
      const result=previewSaleFinances({productCents,freightBaseCents});
      const product=saleSplit(productCents),freight=externalPartnerDeliveryCharge(freightBaseCents);
      assert.equal(result.buyerTotalCents,productCents+freight.customerTotalCents);
      assert.equal(result.platformCommissionCents,product.platformCents+freight.platformCents);
      assert.equal(result.sellerBeforeProcessingCents+result.partnerFreightCents+result.platformCommissionCents,result.buyerTotalCents);
      assert.equal(result.sellerAfterProcessingCents,null);
      assert.equal(result.payoutAllowed,false);
    }
  }
});

test('FC-305: exchange keeps 2.5% per participant, independent 5% per receiving freight, and difference outside FC revenue',()=>{
  const result=previewExchangeFinances({requesterValueCents:9000,ownerValueCents:7000,requesterReceivingFreightCents:1200,ownerReceivingFreightCents:2000});
  assert.equal(result.operation,'exchange');
  assert.equal(result.requester.exchangeCommissionCents,225);
  assert.equal(result.owner.exchangeCommissionCents,175);
  assert.equal(result.requester.freightCommissionCents,60);
  assert.equal(result.owner.freightCommissionCents,100);
  assert.equal(result.requester.freightTotalCents,1260);
  assert.equal(result.owner.freightTotalCents,2100);
  assert.deepEqual(result.difference,{payer:'owner',recipient:'requester',amountCents:2000,status:'not_charged'});
  assert.equal(result.owner.differenceToPayCents,2000);
  assert.equal(result.requester.differenceToReceiveCents,2000);
  assert.equal(result.requester.indicativeObligationBeforeProcessingCents,1485);
  assert.equal(result.owner.indicativeObligationBeforeProcessingCents,4275);
  assert.equal(result.platformCommissionCents,560);
  assert.equal(result.exchangeCommissionCents,400);
  assert.equal(result.freightCommissionCents,160);
  assert.equal(result.freightResponsibility,'receiving_participant_per_leg');
  assert.equal(result.requester.processorFeeCents,null);
  assert.equal(result.owner.processorFeeCents,null);
  assert.equal(result.payoutAllowed,false);
  assert.equal(result.externalChargeCreated,false);
  assert.ok(result.blockers.includes('two_freight_legs_not_homologated'));
});

test('FC-305: balanced or opposite-value exchange never double-counts difference as commission',()=>{
  for(const [requesterValueCents,ownerValueCents] of [[10000,10000],[9999,10000],[10000,9999],[1,100],[100,1]]){
    const result=previewExchangeFinances({requesterValueCents,ownerValueCents,requesterReceivingFreightCents:199,ownerReceivingFreightCents:101});
    assert.equal(result.exchangeCommissionCents,exchangeFee(requesterValueCents)+exchangeFee(ownerValueCents));
    const difference=Math.abs(requesterValueCents-ownerValueCents);
    assert.equal(result.difference?.amountCents??0,difference);
    assert.equal(result.requester.differenceToPayCents+result.owner.differenceToPayCents,difference);
    assert.equal(result.requester.differenceToReceiveCents+result.owner.differenceToReceiveCents,difference);
    assert.equal(result.platformCommissionCents,result.exchangeCommissionCents+result.freightCommissionCents);
    assert.equal(result.payoutAllowed,false);
  }
});

test('FC-305: institutional donation never becomes freight, checkout or payout',()=>{
  const result=previewInstitutionalDonationFinances();
  assert.equal(result.pickup,'institutional');
  assert.equal(result.paymentRequired,false);
  assert.equal(result.buyerTotalCents,0);
  assert.equal(result.freightCents,0);
  assert.equal(result.platformCommissionCents,0);
  assert.equal(result.externalChargeCreated,false);
  assert.equal(result.launchAuthorized,false);
  assert.ok(result.blockers.includes('institutional_pickup_not_homologated'));
});

test('FC-305: invalid/overflow amounts fail closed without creating settlement instructions',()=>{
  for(const input of [
    {productCents:0,freightBaseCents:100},
    {productCents:'10000',freightBaseCents:100},
    {productCents:10000,freightBaseCents:-1},
    {productCents:10000,freightBaseCents:1.5},
    {productCents:2147483647,freightBaseCents:100},
  ])assert.throws(()=>previewSaleFinances(input),RangeError);
  for(const input of [
    {requesterValueCents:0,ownerValueCents:100,requesterReceivingFreightCents:100,ownerReceivingFreightCents:100},
    {requesterValueCents:100000001,ownerValueCents:100,requesterReceivingFreightCents:100,ownerReceivingFreightCents:100},
    {requesterValueCents:100,ownerValueCents:100,requesterReceivingFreightCents:0,ownerReceivingFreightCents:100},
    {requesterValueCents:100,ownerValueCents:100,requesterReceivingFreightCents:100,ownerReceivingFreightCents:Infinity},
  ])assert.throws(()=>previewExchangeFinances(input),RangeError);
});
