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
 const obligation={transaction_id:transaction,payer_id:'requester',recipient_id:'owner',amount_cents:2000,status:'provider_pending',payment_method:'pix',installments:1,provider_reference:'asaas-synthetic'};
 const db=database(sql=>/SELECT \* FROM exchange_difference_obligations/.test(sql)?[obligation]:/UPDATE exchange_difference_obligations SET status='paid'/.test(sql)?[{...obligation,status:'paid',provider_reference:'asaas-synthetic'}]:/UPDATE shipments SET status='awaiting_pickup'/.test(sql)?[{id:'leg-1'},{id:'leg-2'}]:[]);
 const result=await createExchangeRepository(db).recordDifferencePaid({transactionId:transaction,providerReference:'asaas-synthetic',amountCents:2000});assert.equal(result.reused,false);assert.equal(result.difference.status,'paid');assert.equal(db.calls.filter(({sql})=>/INSERT INTO shipment_events/.test(sql)).length,2);assert.match(db.calls.at(-1).sql,/exchange\.difference\.paid/);
 const reusedDb=database(sql=>/SELECT \* FROM exchange_difference_obligations/.test(sql)?[{...obligation,status:'paid',provider_reference:'asaas-synthetic'}]:[]);const reused=await createExchangeRepository(reusedDb).recordDifferencePaid({transactionId:transaction,providerReference:'asaas-synthetic',amountCents:2000});assert.equal(reused.reused,true);assert.equal(reusedDb.calls.length,1);
});

test('a confirmed provider closure allows exactly one retry and method switch',async()=>{
 const active={transaction_id:transaction,payer_id:'requester',status:'provider_pending',provider_reference:'provider-first',checkout_attempt_count:1};const closing=database(sql=>/SELECT \* FROM exchange_difference_obligations/.test(sql)?[active]:/UPDATE exchange_difference_payment_attempts SET status/.test(sql)?[{attempt_number:1,status:'expired'}]:[]);const closed=await createExchangeRepository(closing).closeDifferenceAttempt({transactionId:transaction,providerReference:'provider-first',outcome:'expired'});assert.equal(closed.retryAvailable,true);
 const ready={...active,provider_reference:null};const retry=database(sql=>/SELECT \* FROM exchange_difference_obligations/.test(sql)?[ready]:/SELECT \* FROM exchange_difference_payment_attempts/.test(sql)?[{attempt_number:1,status:'expired'}]:/checkout_attempt_count=2/.test(sql)?[{...ready,payment_method:'credit',checkout_attempt_count:2}]:[]);const result=await createExchangeRepository(retry).retryDifferenceCheckout({actorId:'requester',transactionId:transaction,method:'credit'});assert.equal(result.difference.checkout_attempt_count,2);assert.equal(result.difference.payment_method,'credit');assert.ok(retry.calls.some(({sql})=>/VALUES\(\$1,2,\$2,1\)/.test(sql)));
});

test('uncertain provider state and a third attempt fail closed',async()=>{
 for(const difference of [{transaction_id:transaction,payer_id:'requester',status:'provider_pending',provider_reference:'still-open',checkout_attempt_count:1},{transaction_id:transaction,payer_id:'requester',status:'provider_pending',provider_reference:null,checkout_attempt_count:2}]){const db=database(sql=>/SELECT \* FROM exchange_difference_obligations/.test(sql)?[difference]:/SELECT \* FROM exchange_difference_payment_attempts/.test(sql)?[{status:'expired'}]:[]);await assert.rejects(createExchangeRepository(db).retryDifferenceCheckout({actorId:'requester',transactionId:transaction,method:'pix'}),error=>error.code==='exchange_difference_retry_not_available');}
});

test('only the payer can reserve one immutable checkout method without storing a token',async()=>{
 const obligation={transaction_id:transaction,payer_id:'requester',amount_cents:2000,status:'not_charged',payment_method:null};
 const db=database(sql=>/SELECT \* FROM exchange_difference_obligations/.test(sql)?[obligation]:/UPDATE exchange_difference_obligations SET status='provider_pending'/.test(sql)?[{...obligation,status:'provider_pending',payment_method:'credit',installments:1}]:[]);const result=await createExchangeRepository(db).reserveDifferenceCheckout({actorId:'requester',transactionId:transaction,method:'credit'});assert.equal(result.difference.payment_method,'credit');assert.equal(result.difference.installments,1);assert.deepEqual(db.calls.find(({sql})=>/UPDATE exchange_difference_obligations/.test(sql)).values,[transaction,'credit']);const audit=JSON.parse(db.calls.at(-1).values[2]);assert.deepEqual(audit,{method:'credit',installments:1,tokenStored:false,providerCalled:false});
 const denied=database(sql=>/SELECT \* FROM exchange_difference_obligations/.test(sql)?[obligation]:[]);await assert.rejects(createExchangeRepository(denied).reserveDifferenceCheckout({actorId:'owner',transactionId:transaction,method:'pix'}),error=>error.code==='exchange_difference_not_found');
});

test('expired checkout renews once and second expiry cancels the exchange without provider reference',async()=>{
 const expired={transaction_id:transaction,payer_id:'requester',status:'provider_pending',provider_reference:null,checkout_renewal_count:0,checkout_expires_at:'2020-01-01T00:00:00Z'};const renewal=database(sql=>/SELECT \* FROM exchange_difference_obligations/.test(sql)?[expired]:/checkout_renewal_count=1/.test(sql)?[{...expired,checkout_renewal_count:1,checkout_expires_at:'2030-01-01T00:30:00Z'}]:[]);const renewed=await createExchangeRepository(renewal).renewDifferenceCheckout({actorId:'requester',transactionId:transaction});assert.equal(renewed.difference.checkout_renewal_count,1);assert.match(renewal.calls.at(-1).sql,/checkout_renewed/);
 const due={transaction_id:transaction,requested_listing_id:requested,offered_listing_id:offered};const expiry=database(sql=>/SELECT d\.transaction_id/.test(sql)?[due]:[]);assert.deepEqual(await createExchangeRepository(expiry).expireDifferenceCheckouts({limit:10}),{expired:1});assert.ok(expiry.calls.some(({sql})=>/exchange_difference_obligations SET status='cancelled'/.test(sql)));assert.ok(expiry.calls.some(({sql})=>/UPDATE listings SET status='published'/.test(sql)));assert.match(expiry.calls.at(-1).sql,/checkout_expired/);
});

test('renewal and automatic expiry fail closed after provider processing begins',async()=>{
 const processing={transaction_id:transaction,payer_id:'requester',status:'provider_pending',provider_reference:'provider-1',checkout_renewal_count:0,checkout_expires_at:'2020-01-01T00:00:00Z'};const db=database(sql=>/SELECT \* FROM exchange_difference_obligations/.test(sql)?[processing]:[]);await assert.rejects(createExchangeRepository(db).renewDifferenceCheckout({actorId:'requester',transactionId:transaction}),error=>error.code==='exchange_difference_renewal_not_available');assert.equal(db.calls.length,1);
});

test('due warning creates one internal notice and queues email only when explicitly enabled',async()=>{
 const due={transaction_id:transaction,payer_id:'requester',email:'requester@example.test',email_verified_at:'2030-01-01',email_enabled:true};const db=database(sql=>/SELECT d\.transaction_id/.test(sql)?[due]:[]);assert.deepEqual(await createExchangeRepository(db).dispatchDifferenceWarnings({limit:10}),{warned:1,emailQueued:1});assert.ok(db.calls.some(({sql})=>/INSERT INTO account_notices/.test(sql)));const email=db.calls.find(({sql})=>/INSERT INTO notification_outbox/.test(sql));assert.deepEqual(email.values.slice(0,1),['requester@example.test']);assert.equal(JSON.parse(email.values[1]).channel,'email');assert.match(db.calls.at(-1).sql,/warning_queued/);
 const internalOnly=database(sql=>/SELECT d\.transaction_id/.test(sql)?[{...due,email_enabled:false}]:[]);assert.deepEqual(await createExchangeRepository(internalOnly).dispatchDifferenceWarnings({limit:10}),{warned:1,emailQueued:0});assert.ok(internalOnly.calls.every(({sql})=>!/INSERT INTO notification_outbox/.test(sql)));
});

test('support-approved pre-collection refund records exact provider fee and never executes money',async()=>{
 const difference={transaction_id:transaction,payer_id:'requester',amount_cents:2000,status:'paid'};const operation={requested_listing_id:requested,offered_listing_id:offered};const db=database(sql=>/SELECT \* FROM exchange_difference_obligations/.test(sql)?[difference]:/ AS collected/.test(sql)?[{collected:false}]:/INSERT INTO exchange_difference_refund_reviews/.test(sql)?[{id:'review',gross_amount_cents:2000,nonrecoverable_provider_fee_cents:79,refund_amount_cents:1921,status:'approved'}]:/SELECT requested_listing_id/.test(sql)?[operation]:[]);const result=await createExchangeRepository(db).approveDifferenceRefund({actorId:'finance',transactionId:transaction,nonRecoverableProviderFeeCents:79,providerFeeEvidenceReference:'asaas-fee-case-1',payerAccepted:true});assert.equal(result.quote.refundAmountCents,1921);assert.equal(result.quote.destination,'payment_origin');assert.ok(db.calls.some(({sql})=>/SET status='refund_pending'/.test(sql)));assert.ok(db.calls.some(({sql})=>/UPDATE listings SET status='published'/.test(sql)));assert.ok(db.calls.every(({sql})=>!/payment_intents|provider_case_reference/.test(sql)));assert.equal(JSON.parse(db.calls.at(-1).values[2]).providerExecution,false);
});

test('difference refund is blocked after collection or without a paid obligation',async()=>{
 const paid={transaction_id:transaction,payer_id:'requester',amount_cents:2000,status:'paid'};const collected=database(sql=>/SELECT \* FROM exchange_difference_obligations/.test(sql)?[paid]:/ AS collected/.test(sql)?[{collected:true}]:[]);await assert.rejects(createExchangeRepository(collected).approveDifferenceRefund({actorId:'finance',transactionId:transaction,nonRecoverableProviderFeeCents:0,providerFeeEvidenceReference:'asaas-fee-zero',payerAccepted:true}),/invalid_exchange_difference_refund/);
});

test('post-collection dispute freezes funds and requires a ticket owned by the requesting party',async()=>{
 const context={transaction_id:transaction,requester_id:'requester',owner_id:'owner',status:'paid'};const ticket={id:requested,requester_id:'requester',transaction_id:transaction};const db=database(sql=>/SELECT d\.\*,e\.requester_id/.test(sql)?[context]:/FROM exchange_difference_disputes/.test(sql)?[]:/ AS collected/.test(sql)?[{collected:true}]:/SELECT id,requester_id/.test(sql)?[ticket]:/INSERT INTO exchange_difference_disputes/.test(sql)?[{id:'dispute',transaction_id:transaction,support_ticket_id:requested,opened_by:'requester',status:'open'}]:[]);const result=await createExchangeRepository(db).openDifferenceDispute({actorId:'requester',transactionId:transaction,supportTicketId:requested,reason:'A coleta começou e ocorreu um problema que exige análise.'});assert.equal(result.dispute.status,'open');assert.ok(db.calls.some(({sql})=>/SET status='disputed'/.test(sql)));const audit=JSON.parse(db.calls.at(-1).values[2]);assert.equal(audit.fundsFrozen,true);assert.equal(audit.automaticResolution,false);
});

test('post-collection dispute rejects unrelated tickets and pre-collection cases',async()=>{
 const context={transaction_id:transaction,requester_id:'requester',owner_id:'owner',status:'paid'};const before=database(sql=>/SELECT d\.\*,e\.requester_id/.test(sql)?[context]:/FROM exchange_difference_disputes/.test(sql)?[]:/ AS collected/.test(sql)?[{collected:false}]:[]);await assert.rejects(createExchangeRepository(before).openDifferenceDispute({actorId:'requester',transactionId:transaction,supportTicketId:requested,reason:'Problema ainda anterior à coleta e sem movimentação.'}),error=>error.code==='exchange_difference_dispute_not_available');
});

test('difference dispute requires support, finance and founder as distinct people with one outcome',async()=>{
 const decisions=[];const levels={support:2,finance:3,founder:5};
 const db=database((sql,values)=>{
  if(/SELECT x\.\*,d\.status/.test(sql))return[{id:'dispute',transaction_id:transaction,status:decisions.length>0?'under_review':'open',difference_status:'disputed'}];
  if(/SELECT id FROM exchange_difference_dispute_evidence/.test(sql))return[{id:'evidence'}];
  if(/SELECT stage,actor_user_id,outcome/.test(sql))return decisions;
  if(/SELECT staff_access_level/.test(sql))return[{staff_access_level:levels[values[0]]}];
  if(/INSERT INTO exchange_difference_dispute_decisions/.test(sql)){const decision={stage:values[1],actor_user_id:values[2],actor_access_level:values[3],outcome:values[4],note:values[5]};decisions.push(decision);return[decision];}
  return[];
 });
 const repository=createExchangeRepository(db);const note='Evidências da entrega e do pagamento foram revisadas.';
 const support=await repository.decideDifferenceDispute({actorId:'support',actorAccessLevel:2,transactionId:transaction,stage:'support_analysis',outcome:'release',note});
 const finance=await repository.decideDifferenceDispute({actorId:'finance',actorAccessLevel:3,transactionId:transaction,stage:'finance_approval',outcome:'release',note});
 const founder=await repository.decideDifferenceDispute({actorId:'founder',actorAccessLevel:5,transactionId:transaction,stage:'founder_authorization',outcome:'release',note});
 assert.equal(support.finalAuthorized,false);assert.equal(finance.finalAuthorized,false);assert.equal(founder.finalAuthorized,true);assert.equal(founder.providerExecution,false);
 assert.ok(db.calls.some(({sql})=>/SET status='under_review'/.test(sql)));assert.ok(db.calls.some(({sql})=>/SET status='resolved'/.test(sql)));assert.ok(db.calls.some(({sql})=>/SET status=\$2/.test(sql)));
 assert.deepEqual(db.calls.find(({sql})=>/UPDATE exchange_difference_obligations SET status=\$2/.test(sql)).values,[transaction,'release_pending']);
 assert.equal(JSON.parse(db.calls.at(-1).values[2]).providerExecution,false);
});

test('difference dispute rejects skipped stage, reused actor, changed outcome and wrong stored level',async()=>{
 const dispute={id:'dispute',transaction_id:transaction,status:'open',difference_status:'disputed'};
 const run=({decisions=[],storedLevel=2,actorId='support',actorAccessLevel=2,stage='support_analysis',outcome='release'})=>{
  const db=database((sql)=>/SELECT x\.\*,d\.status/.test(sql)?[dispute]:/SELECT id FROM exchange_difference_dispute_evidence/.test(sql)?[{id:'evidence'}]:/SELECT stage,actor_user_id,outcome/.test(sql)?decisions:/SELECT staff_access_level/.test(sql)?[{staff_access_level:storedLevel}]:[]);
  return createExchangeRepository(db).decideDifferenceDispute({actorId,actorAccessLevel,transactionId:transaction,stage,outcome,note:'Decisão fundamentada pelas evidências disponíveis.'});
 };
 await assert.rejects(run({stage:'finance_approval',actorAccessLevel:3,storedLevel:3}),error=>error.code==='exchange_difference_dispute_sequence_conflict');
 await assert.rejects(run({decisions:[{stage:'support_analysis',actor_user_id:'finance',outcome:'release'}],actorId:'finance',actorAccessLevel:3,stage:'finance_approval',storedLevel:3}),error=>error.code==='exchange_difference_dispute_sequence_conflict');
 await assert.rejects(run({decisions:[{stage:'support_analysis',actor_user_id:'support',outcome:'release'}],actorId:'finance',actorAccessLevel:3,stage:'finance_approval',outcome:'refund_full',storedLevel:3}),error=>error.code==='exchange_difference_dispute_sequence_conflict');
 await assert.rejects(run({storedLevel:3}),error=>error.code==='insufficient_access_level');
});

test('support level 2 records the complete immutable dispute evidence checklist',async()=>{
 const db=database(sql=>/SELECT x\.id,x\.status/.test(sql)?[{id:'dispute',status:'open',difference_status:'disputed'}]:/SELECT staff_access_level/.test(sql)?[{staff_access_level:2}]:/SELECT \* FROM exchange_difference_dispute_evidence/.test(sql)?[]:/INSERT INTO exchange_difference_dispute_evidence/.test(sql)?[{id:'evidence',dispute_id:'dispute'}]:[]);
 const result=await createExchangeRepository(db).recordDifferenceDisputeEvidence({actorId:'support',actorAccessLevel:2,transactionId:transaction,deliveryProofReference:'proof:123',supportHistoryReference:'ticket:123',paymentStatusReference:'payment:123',logisticsStatusReference:'shipment:123',requesterStatementReference:'statement:requester:123',ownerStatementReference:'statement:owner:123'});
 assert.equal(result.immutable,true);const insertion=db.calls.find(({sql})=>/INSERT INTO exchange_difference_dispute_evidence/.test(sql));assert.equal(insertion.values.length,8);assert.deepEqual(JSON.parse(db.calls.at(-1).values[2]),{checklistComplete:true,evidenceReferences:6,filesCopied:false});
});

test('dispute analysis cannot start without the complete evidence checklist',async()=>{
 const db=database(sql=>/SELECT x\.\*,d\.status/.test(sql)?[{id:'dispute',status:'open',difference_status:'disputed'}]:[]);
 await assert.rejects(createExchangeRepository(db).decideDifferenceDispute({actorId:'support',actorAccessLevel:2,transactionId:transaction,stage:'support_analysis',outcome:'release',note:'Análise completa baseada nas evidências.'}),error=>error.code==='exchange_difference_dispute_evidence_incomplete');
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
