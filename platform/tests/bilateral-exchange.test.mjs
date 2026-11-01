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
 assert.deepEqual(result.differenceObligation,{payerId:'requester',recipientId:'owner',lowerValueCents:8000,higherValueCents:10000,amountCents:2000,status:'not_charged',releasePolicy:'after_bilateral_delivery_confirmation'});assert.ok(result.shipments.every(x=>x.status==='provider_pending'));
 const inserts=db.calls.filter(({sql})=>/INSERT INTO shipments/.test(sql));assert.equal(inserts[0].values[1],'owner');assert.equal(inserts[0].values[2],'requester');assert.equal(inserts[1].values[1],'requester');assert.equal(inserts[1].values[2],'owner');assert.notEqual(inserts[0].values[4],inserts[1].values[4]);
 assert.ok(db.calls.every(({sql})=>!/payment_intents|courier_payout_obligations/.test(sql)));
 const fees=db.calls.filter(({sql})=>/INSERT INTO exchange_fee_obligations/.test(sql));assert.equal(fees.length,2);assert.deepEqual(fees.map(x=>x.values.slice(3)),[[8000,200],[10000,250]]);
 assert.deepEqual(db.calls.find(({sql})=>/INSERT INTO exchange_difference_obligations/.test(sql)).values,[transaction,'requester','owner',8000,10000,2000]);assert.ok(db.calls.some(({sql})=>/UPDATE shipments SET status='provider_pending'/.test(sql)));
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

test('difference payment confirmation is idempotent and releases both delivery legs',async()=>{
 const obligation={transaction_id:transaction,payer_id:'requester',recipient_id:'owner',amount_cents:2000,status:'provider_pending',payment_method:'pix',installments:1,provider_reference:null};
 const db=database(sql=>/SELECT \* FROM exchange_difference_obligations/.test(sql)?[obligation]:/UPDATE exchange_difference_obligations SET status='paid'/.test(sql)?[{...obligation,status:'paid',provider_reference:'asaas-synthetic'}]:/UPDATE shipments SET status='awaiting_pickup'/.test(sql)?[{id:'leg-1'},{id:'leg-2'}]:[]);
 const result=await createExchangeRepository(db).recordDifferencePaid({transactionId:transaction,providerReference:'asaas-synthetic',amountCents:2000});assert.equal(result.reused,false);assert.equal(result.difference.status,'paid');assert.equal(db.calls.filter(({sql})=>/INSERT INTO shipment_events/.test(sql)).length,2);assert.match(db.calls.at(-1).sql,/exchange\.difference\.paid/);
 const reusedDb=database(sql=>/SELECT \* FROM exchange_difference_obligations/.test(sql)?[{...obligation,status:'paid',provider_reference:'asaas-synthetic'}]:[]);const reused=await createExchangeRepository(reusedDb).recordDifferencePaid({transactionId:transaction,providerReference:'asaas-synthetic',amountCents:2000});assert.equal(reused.reused,true);assert.equal(reusedDb.calls.length,1);
});

test('only the payer can reserve one immutable checkout method without storing a token',async()=>{
 const obligation={transaction_id:transaction,payer_id:'requester',amount_cents:2000,status:'not_charged',payment_method:null};
 const db=database(sql=>/SELECT \* FROM exchange_difference_obligations/.test(sql)?[obligation]:/UPDATE exchange_difference_obligations SET status='provider_pending'/.test(sql)?[{...obligation,status:'provider_pending',payment_method:'credit',installments:1}]:[]);const result=await createExchangeRepository(db).reserveDifferenceCheckout({actorId:'requester',transactionId:transaction,method:'credit'});assert.equal(result.difference.payment_method,'credit');assert.equal(result.difference.installments,1);assert.deepEqual(db.calls.find(({sql})=>/UPDATE exchange_difference_obligations/.test(sql)).values,[transaction,'credit']);const audit=JSON.parse(db.calls.at(-1).values[2]);assert.deepEqual(audit,{method:'credit',installments:1,tokenStored:false,providerCalled:false});
 const denied=database(sql=>/SELECT \* FROM exchange_difference_obligations/.test(sql)?[obligation]:[]);await assert.rejects(createExchangeRepository(denied).reserveDifferenceCheckout({actorId:'owner',transactionId:transaction,method:'pix'}),error=>error.code==='exchange_difference_not_found');
});

test('completion blocks unpaid difference and marks paid difference ready for release',async()=>{
 const operation={transaction_id:transaction,requested_listing_id:requested,offered_listing_id:offered,status:'accepted',version:2};
 const pending=database(sql=>/SELECT \* FROM exchange_operations/.test(sql)?[operation]:/SELECT count\(\*\)/.test(sql)?[{legs:2,ready:2,assigned:2}]:/SELECT status FROM exchange_difference/.test(sql)?[{status:'provider_pending'}]:[]);await assert.rejects(createExchangeRepository(pending).complete({actorId:'admin',transactionId:transaction}),error=>error.code==='exchange_difference_payment_pending');
 const paid=database(sql=>/SELECT \* FROM exchange_operations/.test(sql)?[operation]:/SELECT count\(\*\)/.test(sql)?[{legs:2,ready:2,assigned:2}]:/SELECT status FROM exchange_difference/.test(sql)?[{status:'paid'}]:/AS financial_records/.test(sql)?[{financial_records:false}]:/UPDATE exchange_operations/.test(sql)?[{...operation,status:'completed',version:3}]:[]);await createExchangeRepository(paid).complete({actorId:'admin',transactionId:transaction});assert.ok(paid.calls.some(({sql})=>/SET status='release_pending'/.test(sql)));
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
 const first=database(sql=>/SELECT \* FROM exchange_operations/.test(sql)?[operation]:/AS collected/.test(sql)?[{collected:false,address_shared:false,financial_difference:false}]:/SELECT user_id FROM exchange_cancellation/.test(sql)?[{user_id:'requester'}]:[]);
 const pending=await createExchangeRepository(first).confirmCancellation({actorId:'requester',transactionId:transaction,expectedVersion:2,reason:'Não conseguirei prosseguir com a troca.'});assert.equal(pending.counterpartConfirmed,false);assert.ok(first.calls.every(({sql})=>!/UPDATE shipments SET status='cancelled'/.test(sql)));
 const second=database(sql=>/SELECT \* FROM exchange_operations/.test(sql)?[operation]:/AS collected/.test(sql)?[{collected:false,address_shared:false,financial_difference:false}]:/SELECT user_id FROM exchange_cancellation/.test(sql)?[{user_id:'requester'},{user_id:'owner'}]:/UPDATE exchange_operations SET status='cancelled'/.test(sql)?[{...operation,status:'cancelled',version:3}]:[]);
 const cancelled=await createExchangeRepository(second).confirmCancellation({actorId:'owner',transactionId:transaction,expectedVersion:2,reason:'Concordo com o cancelamento solicitado.'});assert.equal(cancelled.counterpartConfirmed,true);assert.ok(second.calls.some(({sql})=>/UPDATE shipments SET status='cancelled'/.test(sql)));assert.ok(second.calls.some(({sql})=>/UPDATE listings SET status='published'/.test(sql)));
 assert.ok(second.calls.some(({sql})=>/UPDATE exchange_difference_obligations SET status='cancelled'/.test(sql)));
});

test('collection, proof or address disclosure routes exchange cancellation to support',async()=>{
 const operation={transaction_id:transaction,requester_id:'requester',owner_id:'owner',status:'accepted',version:2};for(const safety of [{collected:true,address_shared:false},{collected:false,address_shared:true},{}]){const db=database(sql=>/SELECT \* FROM exchange_operations/.test(sql)?[operation]:/AS collected/.test(sql)?[safety]:[]);await assert.rejects(createExchangeRepository(db).confirmCancellation({actorId:'requester',transactionId:transaction,expectedVersion:2,reason:'Solicito encerramento seguro da troca.'}),error=>error.code==='exchange_cancellation_requires_support');assert.equal(db.calls.length,2);}
});
