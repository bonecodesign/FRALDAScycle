import assert from "node:assert/strict";
import test from "node:test";
import { createLogisticsService } from "../apps/api/logistics-service.js";
const transactionId="11111111-1111-4111-8111-111111111111";
const shipmentId="22222222-2222-4222-8222-222222222222";

test('shipment replay rejects another owner, transaction or changed options without provider calls', async () => {
  const original={id:shipmentId,transaction_id:transactionId,buyer_id:'buyer-1',mode:'pickup',insured:false,status:'awaiting_pickup'};
  let providerCalls=0;
  const service=createLogisticsService({async context(){return {existing:true,shipment:original};}}, {async createShipment(){providerCalls++;}});
  const input={transactionId,mode:'pickup',insured:false,idempotencyKey:'shipment-safe-replay-0001'};
  assert.equal((await service.create('buyer-1',input)).reused,true);
  for(const [owner,changes] of [['buyer-2',{}],['buyer-1',{insured:true}],['buyer-1',{mode:'partner'}],['buyer-1',{transactionId:shipmentId}]]) {
    await assert.rejects(service.create(owner,{...input,...changes}),e=>e.code==='shipment_idempotency_conflict'&&e.status===409);
  }
  assert.equal(providerCalls,0);
});

test('concurrent shipment winner returned by repository does not call provider twice', async () => {
  let calls=0;
  const service=createLogisticsService({
    async context(){return {existing:false,transaction:{seller_id:'seller-1',status:'paid'}};},
    async createShipment(){return {id:shipmentId,transaction_id:transactionId,mode:'partner',insured:false,status:'provider_pending',reused:true};}
  },{async createShipment(){calls++;}});
  const result=await service.create('buyer-1',{transactionId,mode:'partner',insured:false,idempotencyKey:'shipment-race-replay-0001'});
  assert.equal(result.reused,true);assert.equal(calls,0);
});
