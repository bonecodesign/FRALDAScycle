import assert from 'node:assert/strict';
import test from 'node:test';
import {createReceiptRepository} from '../database/receipt-repository.js';
import {createLogisticsService} from '../apps/api/logistics-service.js';

const shipmentId='11111111-1111-4111-8111-111111111111';
const ready={shipment_id:shipmentId,transaction_id:'tx',courier_id:'courier',shipment_status:'delivered',transaction_status:'in_delivery',kind:'sale',proof_id:'proof',approved_at:'2026-10-08T12:00:00Z',validated_at:'2026-10-08T12:01:00Z',payment_intent_id:'payment',payment_status:'paid',paid_count:1,delivery_fee_cents:2000,payment_provider_reference:'provider',financial_case_pending:false};
function database(row=ready,existing=null){const calls=[];const client={async query(sql,values){calls.push({sql,values});if(/SELECT s.id AS shipment_id/.test(sql))return {rows:row?[row]:[]};if(/SELECT \* FROM courier_payout_obligations/.test(sql))return {rows:existing?[existing]:[]};if(/INSERT INTO courier_payout_obligations/.test(sql))return {rows:[{id:'obligation',courier_amount_cents:1900,platform_fee_cents:100,status:'provider_pending'}]};return {rows:[]};}};return {calls,async transaction(work){return work(client);},query:client.query};}

test('eligible delivery creates an idempotent 95/5 obligation without paying it',async()=>{
 const db=database();const result=await createReceiptRepository(db).prepareCourierPayout({actorId:'admin',shipmentId});
 assert.equal(result.courier_amount_cents,1900);assert.equal(result.status,'provider_pending');
 const insert=db.calls.find(({sql})=>/INSERT INTO courier_payout_obligations/.test(sql));assert.deepEqual(insert.values.slice(4,7),[2000,100,1900]);
 assert.ok(db.calls.every(({sql})=>!/UPDATE courier_payout_obligations[\s\S]*status='paid'|transfer\s*\(/i.test(sql)));
 assert.match(db.calls.at(-1).sql,/courier\.payout\.prepared/);
});

test('existing obligation is returned without duplicate write or audit',async()=>{
 const existing={id:'obligation',shipment_id:shipmentId,status:'provider_pending'};const db=database(ready,existing);const result=await createReceiptRepository(db).prepareCourierPayout({actorId:'admin',shipmentId});
 assert.equal(result.reused,true);assert.equal(db.calls.length,2);
});

test('each safety prerequisite blocks obligation creation',async()=>{
 const cases=[{kind:'donation'},{shipment_status:'in_transit'},{transaction_status:'disputed'},{payment_status:null},{paid_count:2},{payment_provider_reference:null},{delivery_fee_cents:0},{financial_case_pending:true},{approved_at:null},{validated_at:null},{courier_id:null}];
 for(const patch of cases){const db=database({...ready,...patch});await assert.rejects(createReceiptRepository(db).prepareCourierPayout({actorId:'admin',shipmentId}),error=>error.code==='courier_payout_not_eligible'&&error.blockers.length>0);assert.equal(db.calls.length,1);}
});

test('status is visible only to assigned courier or authorized reviewer and never authorizes transfer',async()=>{
 const db=database();const row=await createReceiptRepository(db).courierPayoutStatus({actorId:'courier',shipmentId});assert.equal(row.courier_id,'courier');assert.match(db.calls[0].sql,/s\.courier_id=\$2/);assert.match(db.calls.at(-1).sql,/courier\.payout\.status\.read/);
 const service=createLogisticsService({async courierPayoutStatus(){return ready;}});
 const status=await service.courierPayoutStatus({id:'courier',role:'courier'},shipmentId);assert.equal(status.eligible,true);assert.equal(status.payoutAllowed,false);assert.equal(status.status,'not_prepared');
});

test('only delivery reviewer can prepare and explicit confirmation is mandatory',async()=>{
 const service=createLogisticsService({prepareCourierPayout:()=>assert.fail('must not persist')});
 await assert.rejects(service.prepareCourierPayout({id:'courier',role:'courier'},shipmentId,{confirmed:true}),error=>error.code==='forbidden');
 await assert.rejects(service.prepareCourierPayout({id:'admin',role:'admin'},shipmentId,{confirmed:false}),error=>error.code==='explicit_payout_preparation_required');
});
