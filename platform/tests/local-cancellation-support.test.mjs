import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperationSupportRepository } from '../database/operation-support-repository.js';
import { createMarketplaceService } from '../apps/api/marketplace-service.js';
import { createPaymentRepository } from '../database/payment-repository.js';
import { createApiServer } from '../apps/api/server.js';
import { loadConfig } from '../apps/api/config.js';
const id='22222222-2222-4222-8222-222222222222';
function database(answer) {
  const calls=[];
  const client={async query(sql,values){calls.push({sql,values});return {rows:answer(sql,values)||[]};}};
  return {calls,async transaction(operation){return operation(client);},query:client.query};
}
const unpaid={id,listing_id:'listing',seller_id:'seller',status:'initiated',address_shared_at:null};
test('unpaid pre-collection cancellation updates listing and audit atomically',async()=>{
  const db=database(sql=>/SELECT id,listing_id/.test(sql)?[unpaid]:/AS collected/.test(sql)?[{collected:false,has_payment:false}]:/FOR NO KEY UPDATE/.test(sql)?[{id:'seller'}]:/checked_at/.test(sql)?[{checked_at:'2026-10-05T12:00:00Z',subscription:null}]:/AS suspended/.test(sql)?[{suspended:false}]:/count\(\*\)/.test(sql)?[{count:2}]:[]);
  const result=await createOperationSupportRepository(db).cancelTransaction({actorId:'buyer',transactionId:id});
  assert.equal(result.status,'cancelled');
  assert.match(db.calls[0].sql,/FOR UPDATE/);
  assert.match(db.calls.at(-1).sql,/transaction.cancelled/);
  assert.deepEqual(db.calls.find(call=>/UPDATE listings/.test(call.sql)).values,['listing','published']);
});
test('collection history, address release, any payment and disputed state route to support without writes',async()=>{
  for(const [tx,state] of [
    [unpaid,{collected:true,has_payment:false}],
    [{...unpaid,address_shared_at:'2030-01-01'},{collected:false,has_payment:false}],
    [unpaid,{collected:false,has_payment:true}],
    [{...unpaid,status:'disputed'},{collected:false,has_payment:false}],
    [unpaid,{}],
  ]){
    const db=database(sql=>/SELECT id,listing_id/.test(sql)?[tx]:/AS collected/.test(sql)?[state]:[]);
    await assert.rejects(createOperationSupportRepository(db).cancelTransaction({actorId:'buyer',transactionId:id}),error=>error.code==='cancellation_requires_support');
    assert.equal(db.calls.length,2);
    assert.match(db.calls[1].sql,/shipment_events/);
  }
});
test('cancelled or unauthorized operation cannot be changed',async()=>{
  for(const row of [null,{...unpaid,status:'completed'}]){
    const db=database(()=>row?[row]:[]);
    await assert.rejects(createOperationSupportRepository(db).cancelTransaction({actorId:'other',transactionId:id}));
    assert.equal(db.calls.length,1);
    assert.match(db.calls[0].sql,/\$2 IN \(buyer_id,seller_id\)/);
  }
});
test('new payment rechecks transaction under lock and cannot charge a cancelled operation',async()=>{
  const db=database(()=>[]);
  await assert.rejects(createPaymentRepository(db).createIntent({buyerId:'buyer',transactionId:id}),error=>error.code==='transaction_not_payable');
  assert.equal(db.calls.length,1);
  assert.match(db.calls[0].sql,/FOR UPDATE/);
});
test('support creation checks transaction ownership and records a stable protocol without external actions',async()=>{
  const db=database(sql=>/SELECT id FROM transactions/.test(sql)?[{id}]:/INSERT INTO support_tickets/.test(sql)?[{id,protocol:'42',requester_id:'buyer',status:'open'}]:[]);
  const result=await createOperationSupportRepository(db).createSupportTicket({requesterId:'buyer',transactionId:id,category:'cancellation',subject:'Cancelar operação',details:'Preciso de atendimento para cancelar.',idempotencyKey:'support-key-123456'});
  assert.equal(result.ticket.protocol,'42');
  assert.equal(result.reused,false);
  assert.match(db.calls[1].sql,/\$2 IN \(buyer_id,seller_id\)/);
  assert.match(db.calls.at(-1).sql,/support.ticket.created/);
  assert.ok(db.calls.every(({sql})=>!/UPDATE transactions|UPDATE payment/.test(sql)));
});
test('idempotent support retries cannot disclose another account ticket',async()=>{
  const db=database(()=>[{id,requester_id:'buyer',protocol:'42'}]);
  const repository=createOperationSupportRepository(db);
  assert.equal((await repository.createSupportTicket({requesterId:'buyer',idempotencyKey:'key'})).reused,true);
  await assert.rejects(repository.createSupportTicket({requesterId:'other',idempotencyKey:'key'}),error=>error.code==='support_key_conflict');
});
test('support input and reply permissions are enforced before persistence',async()=>{
  const service=createMarketplaceService({createSupportTicket:()=>assert.fail(),replySupportTicket:()=>assert.fail()});
  await assert.rejects(service.createSupportTicket('buyer',{category:'cancellation',subject:'Pedido válido',details:'Descrição válida para suporte.',idempotencyKey:'support-key-123456'}),error=>error.code==='invalid_support_ticket');
  await assert.rejects(service.replySupportTicket({id:'buyer',role:'customer'},id,{body:'Resposta válida',status:'resolved'}),error=>error.code==='forbidden');
  await assert.rejects(service.replySupportTicket({id:'admin',role:'admin'},id,{body:'curta',status:'resolved'}),error=>error.code==='invalid_support_reply');
});
test('support details are private, read-audited, and include chronological response history',async()=>{
  const missing=database(()=>[]);
  await assert.rejects(createOperationSupportRepository(missing).supportTicket({userId:'other',ticketId:id}),error=>error.code==='support_ticket_not_found');
  assert.equal(missing.calls.length,1);
  assert.deepEqual(missing.calls[0].values,[id,'other',false]);
  const db=database(sql=>/SELECT \*/.test(sql)?[{id,protocol:'42'}]:/SELECT id,body/.test(sql)?[{id:1,body:'Resposta do atendimento.'}]:[]);
  const ticket=await createOperationSupportRepository(db).supportTicket({userId:'buyer',ticketId:id});
  assert.equal(ticket.messages.length,1);
  assert.match(db.calls.at(-1).sql,/support.ticket.read/);
});
test('administrative reply records history and status but never cancels or refunds',async()=>{
  const db=database(sql=>/SELECT id FROM support_tickets/.test(sql)?[{id}]:/INSERT INTO support_ticket_messages/.test(sql)?[{id:'1'}]:[]);
  const result=await createOperationSupportRepository(db).replySupportTicket({actorId:'admin',ticketId:id,body:'Pedido em análise pelo atendimento.',status:'under_review',idempotencyKey:'synthetic-support-reply-key'});
  assert.equal(result.status,'under_review');
  assert.equal(db.calls.length,5);
  assert.ok(db.calls.every(({sql})=>!/UPDATE transactions|UPDATE payment/.test(sql)));
});
test('support HTTP requires session, exposes protocol, and protects administrative replies',async context=>{
  const service=createMarketplaceService({
    async createSupportTicket(input){return {ticket:{id,protocol:'42'},reused:false};},
    async supportTickets({userId,reviewer}){assert.equal(userId,'buyer');assert.equal(reviewer,false);return [{id,protocol:'42'}];},
  });
  const server=createApiServer({config:loadConfig({NODE_ENV:'test'}),marketplaceService:service,
    authService:{async session(token){return token==='buyer'?{id:'buyer',role:'customer'}:null;}}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));context.after(()=>server.close());
  const root=`http://127.0.0.1:${server.address().port}/v1/support/tickets`;
  assert.equal((await fetch(root)).status,401);
  const list=await fetch(root,{headers:{cookie:'fc_session=buyer'}});
  assert.equal(list.headers.get('cache-control'),'no-store');
  assert.equal((await list.json()).items[0].protocol,'42');
  const reply=await fetch(root+'/'+id+'/reply',{method:'POST',headers:{cookie:'fc_session=buyer','content-type':'application/json'},body:JSON.stringify({body:'Resposta válida para teste.'})});
  assert.equal(reply.status,403);
});
