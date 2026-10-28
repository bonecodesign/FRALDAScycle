import assert from 'node:assert/strict';
import test from 'node:test';
import {createExchangeRepository} from '../database/exchange-repository.js';
import {createExchangeService} from '../apps/api/exchange-service.js';
import {createReceiptRepository} from '../database/receipt-repository.js';

const requested='11111111-1111-4111-8111-111111111111',offered='22222222-2222-4222-8222-222222222222',transaction='33333333-3333-4333-8333-333333333333';
function database(answer){const calls=[];const client={async query(sql,values){calls.push({sql,values});return {rows:answer(sql,values,calls)||[]};}};return {calls,async transaction(work){return work(client);},query:client.query};}

test('proposal requires two sealed published exchange listings owned by opposite parties',async()=>{
 const db=database(sql=>/SELECT id,seller_id,kind/.test(sql)?[{id:requested,seller_id:'owner',kind:'exchange',status:'published',package_condition:'sealed'},{id:offered,seller_id:'requester',kind:'exchange',status:'published',package_condition:'sealed'}]:/INSERT INTO transactions/.test(sql)?[{id:transaction}]:/INSERT INTO exchange_operations/.test(sql)?[{transaction_id:transaction,status:'proposed',version:1}]:[]);
 const result=await createExchangeRepository(db).propose({actorId:'requester',requestedListingId:requested,offeredListingId:offered,requesterDeclaredValueCents:8000});assert.equal(result.status,'proposed');assert.equal(db.calls.find(({sql})=>/INSERT INTO exchange_operations/.test(sql)).values[5],8000);assert.match(db.calls.at(-1).sql,/exchange\.proposed/);assert.ok(db.calls.every(({sql})=>!/UPDATE listings/.test(sql)));
});

test('acceptance locks both listings and creates exactly two opposite independent legs',async()=>{
 const operation={transaction_id:transaction,requested_listing_id:requested,offered_listing_id:offered,requester_id:'requester',owner_id:'owner',requester_declared_value_cents:8000,status:'proposed',version:1};let shipment=0;
 const db=database(sql=>/SELECT \* FROM exchange_operations/.test(sql)?[operation]:/UPDATE listings SET status='unavailable'/.test(sql)?[{id:requested},{id:offered}]:/INSERT INTO shipments/.test(sql)?[{id:`shipment-${++shipment}`,transaction_id:transaction,status:'awaiting_pickup',exchange_leg:shipment}]:/UPDATE exchange_operations SET status='accepted'/.test(sql)?[{...operation,status:'accepted',version:2}]:[]);
 const result=await createExchangeRepository(db).accept({actorId:'owner',transactionId:transaction,expectedVersion:1,ownerDeclaredValueCents:10000});assert.equal(result.shipments.length,2);assert.deepEqual(result.feeObligations.map(x=>x.fee_cents),[200,250]);
 const inserts=db.calls.filter(({sql})=>/INSERT INTO shipments/.test(sql));assert.equal(inserts[0].values[1],'owner');assert.equal(inserts[0].values[2],'requester');assert.equal(inserts[1].values[1],'requester');assert.equal(inserts[1].values[2],'owner');assert.notEqual(inserts[0].values[4],inserts[1].values[4]);
 assert.ok(db.calls.every(({sql})=>!/payment_intents|courier_payout_obligations/.test(sql)));
 const fees=db.calls.filter(({sql})=>/INSERT INTO exchange_fee_obligations/.test(sql));assert.equal(fees.length,2);assert.deepEqual(fees.map(x=>x.values.slice(3)),[[8000,200],[10000,250]]);
});

test('exchange completion fails until both legs are independently assigned, delivered, approved and validated',async()=>{
 const operation={transaction_id:transaction,requested_listing_id:requested,offered_listing_id:offered,status:'accepted',version:2};
 for(const readiness of [{legs:2,ready:1,assigned:2},{legs:2,ready:2,assigned:1}]){const db=database(sql=>/SELECT \* FROM exchange_operations/.test(sql)?[operation]:/SELECT count\(\*\)/.test(sql)?[readiness]:[]);await assert.rejects(createExchangeRepository(db).complete({actorId:'admin',transactionId:transaction}),error=>error.code==='exchange_legs_pending');assert.equal(db.calls.length,2);}
});

test('complete exchange has no payment record and atomically closes transaction and both listings',async()=>{
 const operation={transaction_id:transaction,requested_listing_id:requested,offered_listing_id:offered,status:'accepted',version:2};
 const db=database(sql=>/SELECT \* FROM exchange_operations/.test(sql)?[operation]:/SELECT count\(\*\)/.test(sql)?[{legs:2,ready:2,assigned:2}]:/AS financial_records/.test(sql)?[{financial_records:false}]:/UPDATE exchange_operations/.test(sql)?[{...operation,status:'completed',version:3}]:[]);
 const result=await createExchangeRepository(db).complete({actorId:'admin',transactionId:transaction});assert.equal(result.status,'completed');assert.ok(db.calls.some(({sql})=>/UPDATE transactions SET status='completed'/.test(sql)));assert.deepEqual(db.calls.find(({sql})=>/UPDATE listings SET status='completed'/.test(sql)).values,[[requested,offered]]);assert.equal(JSON.parse(db.calls.at(-1).values[2]).financialSettlement,false);
});

test('exchange receipts use each leg receiver and still require independent validation',async()=>{
 const row={status:'delivered',buyer_id:'receiver',seller_id:'sender',courier_id:'courier',transaction_status:'in_delivery',kind:'exchange',proof_id:'proof'};
 const db=database(sql=>/FOR UPDATE OF s,t/.test(sql)?[row]:/INSERT INTO delivery_receipt_approvals/.test(sql)?[{recorded_at:'2026-10-08'}]:[]);
 const result=await createReceiptRepository(db).recordReceiptDecision({actorId:'receiver',shipmentId:'shipment'});assert.equal(result.reused,false);
 await assert.rejects(createReceiptRepository(database(sql=>/FOR UPDATE OF s,t/.test(sql)?[row]:[])).recordReceiptDecision({actorId:'sender',shipmentId:'shipment'}),error=>error.code==='receipt_not_found');
});

test('service requires explicit bilateral decisions and admin-only completion',async()=>{
 const service=createExchangeService({propose:()=>assert.fail(),accept:()=>assert.fail(),complete:()=>assert.fail()});
 assert.throws(()=>service.propose({id:'requester'},{requestedListingId:requested,offeredListingId:offered,confirmed:false}),error=>error.code==='invalid_exchange');
 assert.throws(()=>service.accept({id:'owner'},transaction,{expectedVersion:1,confirmed:false}),error=>error.code==='invalid_exchange');
 assert.throws(()=>service.propose({id:'requester'},{requestedListingId:requested,offeredListingId:offered,requesterDeclaredValueCents:0,confirmed:true}),error=>error.code==='invalid_exchange');
 assert.throws(()=>service.accept({id:'owner'},transaction,{expectedVersion:1,ownerDeclaredValueCents:0,confirmed:true}),error=>error.code==='invalid_exchange');
 assert.throws(()=>service.complete({id:'owner',role:'customer'},transaction,{confirmed:true}),error=>error.code==='forbidden');
});

test('owner can refuse a proposal without locking either listing',async()=>{
 const operation={transaction_id:transaction,owner_id:'owner',status:'proposed',version:1};const db=database(sql=>/SELECT \* FROM exchange_operations/.test(sql)?[operation]:/UPDATE exchange_operations SET status='refused'/.test(sql)?[{...operation,status:'refused',version:2,refusal_reason:'Itens não atendem à necessidade.'}]:[]);
 const result=await createExchangeRepository(db).refuse({actorId:'owner',transactionId:transaction,expectedVersion:1,reason:'Itens não atendem à necessidade.'});assert.equal(result.status,'refused');assert.ok(db.calls.every(({sql})=>!/UPDATE listings/.test(sql)));assert.match(db.calls.at(-1).sql,/exchange\.refused/);
});

test('accepted exchange cancels only after both parties confirm and before address or collection',async()=>{
 const operation={transaction_id:transaction,requested_listing_id:requested,offered_listing_id:offered,requester_id:'requester',owner_id:'owner',status:'accepted',version:2};
 const first=database(sql=>/SELECT \* FROM exchange_operations/.test(sql)?[operation]:/AS collected/.test(sql)?[{collected:false,address_shared:false}]:/SELECT user_id FROM exchange_cancellation/.test(sql)?[{user_id:'requester'}]:[]);
 const pending=await createExchangeRepository(first).confirmCancellation({actorId:'requester',transactionId:transaction,expectedVersion:2,reason:'Não conseguirei prosseguir com a troca.'});assert.equal(pending.counterpartConfirmed,false);assert.ok(first.calls.every(({sql})=>!/UPDATE shipments SET status='cancelled'/.test(sql)));
 const second=database(sql=>/SELECT \* FROM exchange_operations/.test(sql)?[operation]:/AS collected/.test(sql)?[{collected:false,address_shared:false}]:/SELECT user_id FROM exchange_cancellation/.test(sql)?[{user_id:'requester'},{user_id:'owner'}]:/UPDATE exchange_operations SET status='cancelled'/.test(sql)?[{...operation,status:'cancelled',version:3}]:[]);
 const cancelled=await createExchangeRepository(second).confirmCancellation({actorId:'owner',transactionId:transaction,expectedVersion:2,reason:'Concordo com o cancelamento solicitado.'});assert.equal(cancelled.counterpartConfirmed,true);assert.ok(second.calls.some(({sql})=>/UPDATE shipments SET status='cancelled'/.test(sql)));assert.ok(second.calls.some(({sql})=>/UPDATE listings SET status='published'/.test(sql)));
});

test('collection, proof or address disclosure routes exchange cancellation to support',async()=>{
 const operation={transaction_id:transaction,requester_id:'requester',owner_id:'owner',status:'accepted',version:2};for(const safety of [{collected:true,address_shared:false},{collected:false,address_shared:true},{}]){const db=database(sql=>/SELECT \* FROM exchange_operations/.test(sql)?[operation]:/AS collected/.test(sql)?[safety]:[]);await assert.rejects(createExchangeRepository(db).confirmCancellation({actorId:'requester',transactionId:transaction,expectedVersion:2,reason:'Solicito encerramento seguro da troca.'}),error=>error.code==='exchange_cancellation_requires_support');assert.equal(db.calls.length,2);}
});
