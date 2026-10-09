import assert from 'node:assert/strict';
import test from 'node:test';
import {createOperationSupportRepository} from '../database/operation-support-repository.js';
import {createMarketplaceService} from '../apps/api/marketplace-service.js';
import {createPaymentRepository} from '../database/payment-repository.js';
import {createLogisticsRepository} from '../database/logistics-repository.js';
import {createLogisticsService} from '../apps/api/logistics-service.js';

const tx='22222222-2222-4222-8222-222222222222';
const ticket='33333333-3333-4333-8333-333333333333';
function database(answer){const calls=[];const client={async query(sql,values){calls.push({sql,values});return {rows:answer(sql,values,calls)||[]};}};return {calls,async transaction(work){return work(client);},query:client.query};}

test('paid webhook unlocks structured contact for sales in the financial transaction',async()=>{
  const db=database(sql=>/INSERT INTO payment_webhook_events/.test(sql)?[{id:'event'}]
    :/SELECT p.id, p.transaction_id/.test(sql)?[{id:'intent',transaction_id:tx,amount_cents:10000,status:'pending'}]:[]);
  const result=await createPaymentRepository(db).processWebhook({id:'event',type:'payment.paid',providerReference:'provider',occurredAt:new Date().toISOString(),payloadHash:'hash',amountCents:10000});
  assert.equal(result.status,'paid');
  const grant=db.calls.find(({sql})=>/INSERT INTO transaction_contact_access/.test(sql));
  assert.deepEqual(grant.values,[tx,'intent']);
  assert.match(grant.sql,/l\.kind='sale'/);
});

test('contact exposes only verified channels and audits channel names without values',async()=>{
  const db=database(sql=>/SELECT t.id,t.status/.test(sql)?[{id:tx,status:'paid',kind:'sale',display_name:'Pessoa vendedora',email:'venda@example.test',phone:'+5531999999999',email_verified_at:new Date(),phone_verified_at:null,unlocked_at:new Date(),revoked_at:null}]:[]);
  const contact=await createOperationSupportRepository(db).transactionContact({actorId:'buyer',transactionId:tx});
  assert.equal(contact.email,'venda@example.test');
  assert.equal(contact.phone,undefined);
  const audit=db.calls.at(-1);
  assert.match(audit.sql,/transaction\.contact\.read/);
  assert.ok(!JSON.stringify(audit.values).includes('venda@example.test'));
});

test('missing, revoked, unpaid or unrelated contact fails closed without an audit read',async()=>{
  const db=database(()=>[]);
  await assert.rejects(createOperationSupportRepository(db).transactionContact({actorId:'other',transactionId:tx}),error=>error.code==='contact_not_available');
  assert.equal(db.calls.length,1);
  assert.match(db.calls[0].sql,/\$2 IN \(t\.buyer_id,t\.seller_id\)/);
});

test('support decision deducts snapshotted fees, revokes contact and routes transaction to dispute',async()=>{
  const db=database((sql,values,calls)=>/SELECT st.id AS ticket_id/.test(sql)?[{ticket_id:ticket,transaction_id:tx,category:'cancellation',transaction_status:'paid',payment_intent_id:'intent',amount_cents:10000,platform_fee_cents:800,delivery_fee_cents:0}]
    :/SELECT \* FROM supported_cancellations/.test(sql)?[]
    :/INSERT INTO supported_cancellations/.test(sql)?[{id:'cancel',transaction_id:tx,refund_amount_cents:9200,status:'provider_pending'}]:[]);
  const result=await createOperationSupportRepository(db).supportCancellationDecision({actorId:'admin',ticketId:ticket,reason:'Cancelamento confirmado pelo atendimento.'});
  assert.equal(result.cancellation.refund_amount_cents,9200);
  const insert=db.calls.find(({sql})=>/INSERT INTO supported_cancellations/.test(sql));
  assert.deepEqual(insert.values.slice(4,8),[10000,800,0,9200]);
  assert.ok(db.calls.some(({sql})=>/UPDATE transactions SET status='disputed'/.test(sql)));
  assert.ok(db.calls.some(({sql})=>/UPDATE transaction_contact_access SET revoked_at/.test(sql)));
  const audit=db.calls.at(-1);
  assert.match(audit.sql,/supported_cancellation\.decided/);
});

test('support cancellation requires admin confirmation and adequate rationale',async()=>{
  const service=createMarketplaceService({supportCancellationDecision:()=>assert.fail('must not persist')});
  await assert.rejects(service.supportCancellationDecision({id:'buyer',role:'customer'},ticket,{confirmed:true,reason:'Justificativa suficiente.'}),error=>error.code==='forbidden');
  await assert.rejects(service.supportCancellationDecision({id:'admin',role:'admin'},ticket,{confirmed:false,reason:'Justificativa suficiente.'}),error=>error.code==='invalid_cancellation_decision');
});

test('repeated support decision is idempotent and cannot duplicate the refund workflow',async()=>{
  const db=database(sql=>/SELECT st.id AS ticket_id/.test(sql)?[{ticket_id:ticket,transaction_id:tx,transaction_status:'disputed',payment_intent_id:'intent',amount_cents:10000,platform_fee_cents:800,delivery_fee_cents:0}]
    :/SELECT \* FROM supported_cancellations/.test(sql)?[{id:'cancel',transaction_id:tx,refund_amount_cents:9200,status:'provider_pending'}]:[]);
  const result=await createOperationSupportRepository(db).supportCancellationDecision({actorId:'admin',ticketId:ticket,reason:'Repetição segura da decisão.'});
  assert.equal(result.reused,true);
  assert.equal(db.calls.length,2);
});

test('only assigned courier sees the single verified phone required by the active stage',async()=>{
  const db=database(sql=>/SELECT s.id,s.status/.test(sql)?[{id:'shipment',status:'assigned',display_name:'Pessoa vendedora',phone:'+5531999999999',phone_verified_at:new Date(),purpose:'pickup'}]:[]);
  const contact=await createLogisticsRepository(db).courierContact({courierId:'courier',shipmentId:'shipment'});
  assert.deepEqual(contact,{displayName:'Pessoa vendedora',phone:'+5531999999999',purpose:'pickup'});
  assert.match(db.calls.at(-1).sql,/shipment\.contact\.read/);
  assert.ok(!JSON.stringify(db.calls.at(-1).values).includes('+5531999999999'));
  const service=createLogisticsService({courierContact:()=>assert.fail('must not query')});
  await assert.rejects(service.courierContact({id:'admin',role:'admin'},'shipment'),error=>error.code==='forbidden');
});
