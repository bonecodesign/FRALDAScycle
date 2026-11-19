import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createMarketplaceService} from '../apps/api/marketplace-service.js';
import {createDatabase} from '../database/client.js';
import {createMarketplaceRepository} from '../database/marketplace-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const ids={owner:'11111111-1111-4111-8111-111111111111',outsider:'22222222-2222-4222-8222-222222222222',admin:'33333333-3333-4333-8333-333333333333',secondAdmin:'44444444-4444-4444-8444-444444444444'};

test('internal support is private, assigned, idempotent and audited over HTTP/PostgreSQL',{skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{
  const database=createDatabase({databaseUrl,databaseSsl:false});let api;
  try{
   await migrate(database,await discoverMigrations());
   await database.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
    ($1,'support-owner@example.test','fixture','Titular fictício','customer'),
    ($2,'support-outsider@example.test','fixture','Pessoa externa','customer'),
    ($3,'support-admin@example.test','fixture','Atendente fictício','admin'),
    ($4,'support-second@example.test','fixture','Outro atendente','admin')`,Object.values(ids));
   const actors={owner:{id:ids.owner,role:'customer'},outsider:{id:ids.outsider,role:'customer'},admin:{id:ids.admin,role:'admin',staffSector:'operations'},second:{id:ids.secondAdmin,role:'admin',staffSector:'finance'}};
   api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),marketplaceService:createMarketplaceService(createMarketplaceRepository(database)),authService:{async session(token){return actors[token]??null;}}});
   await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
   const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({cookie:`fc_session=${token}`,'content-type':'application/json'}),root=`${origin}/v1/support/tickets`;
   const ticketInput={category:'general',subject:'Ajuda fictícia com a conta',details:'Descrição sintética suficiente para abrir o atendimento interno.',idempotencyKey:'support-operations-http-postgres'};
   const created=await fetch(root,{method:'POST',headers:headers('owner'),body:JSON.stringify(ticketInput)}),createdBody=await created.json();assert.equal(created.status,201,JSON.stringify(createdBody));assert.equal(createdBody.reused,false);assert.ok(createdBody.ticket.protocol);const ticketId=createdBody.ticket.id;
   const replay=await fetch(root,{method:'POST',headers:headers('owner'),body:JSON.stringify(ticketInput)});assert.equal(replay.status,200);assert.equal((await replay.json()).reused,true);
   assert.equal((await fetch(`${root}/${ticketId}`,{headers:headers('outsider')})).status,404);
   const customerClaim=await fetch(`${root}/${ticketId}/assignment`,{method:'POST',headers:headers('owner'),body:JSON.stringify({action:'claim'})});assert.equal(customerClaim.status,403);
   const claimed=await fetch(`${root}/${ticketId}/assignment`,{method:'POST',headers:headers('admin'),body:JSON.stringify({action:'claim'})}),claimedBody=await claimed.json();assert.equal(claimed.status,200,JSON.stringify(claimedBody));assert.equal(claimedBody.assignment.assigned_to_me,true);
   const competing=await fetch(`${root}/${ticketId}/assignment`,{method:'POST',headers:headers('second'),body:JSON.stringify({action:'claim'})});assert.equal(competing.status,409);
   const noteInput={body:'Contexto interno fictício que não deve aparecer para o cliente.',idempotencyKey:'55555555-5555-4555-8555-555555555555'};
   const noted=await fetch(`${root}/${ticketId}/notes`,{method:'POST',headers:headers('admin'),body:JSON.stringify(noteInput)}),notedBody=await noted.json();assert.equal(noted.status,201,JSON.stringify(notedBody));assert.equal(notedBody.note.reused,false);
   const noteReplay=await fetch(`${root}/${ticketId}/notes`,{method:'POST',headers:headers('admin'),body:JSON.stringify(noteInput)});assert.equal(noteReplay.status,200);assert.equal((await noteReplay.json()).note.reused,true);
   const attemptedCustomerNote=await fetch(`${root}/${ticketId}/notes`,{method:'POST',headers:headers('owner'),body:JSON.stringify({...noteInput,idempotencyKey:'66666666-6666-4666-8666-666666666666'})});assert.equal(attemptedCustomerNote.status,403);
   // Classification is a human-only decision, not a parameter controlled by customers.
   const forbiddenTriage=await fetch(`${root}/${ticketId}/priority`,{method:'POST',headers:headers('owner'),body:JSON.stringify({priority:'critical',reason:'Urgência fictícia sem autoridade.'})});assert.equal(forbiddenTriage.status,403);
   const invalidTriage=await fetch(`${root}/${ticketId}/priority`,{method:'POST',headers:headers('admin'),body:JSON.stringify({priority:'critical',reason:'Urgência fictícia sem autoridade.',pauseOperations:true})});assert.equal(invalidTriage.status,422);
   const forbiddenAttention=await fetch(`${origin}/v1/support/attention`,{headers:headers('owner')});assert.equal(forbiddenAttention.status,403);
   await database.query("UPDATE support_tickets SET created_at=now()-interval '1 hour' WHERE id=$1",[ticketId]);
   const classified=await fetch(`${root}/${ticketId}/priority`,{method:'POST',headers:headers('admin'),body:JSON.stringify({priority:'critical',reason:'Incidente sintético necessita triagem humana.'})}),classification=await classified.json();
   assert.equal(classified.status,200,JSON.stringify(classification));assert.equal(classification.priority,'critical');assert.equal(classification.reused,false);
   const replayPriority=await fetch(`${root}/${ticketId}/priority`,{method:'POST',headers:headers('admin'),body:JSON.stringify({priority:'critical',reason:'Incidente sintético necessita triagem humana.'})});assert.equal(replayPriority.status,200);assert.equal((await replayPriority.json()).reused,true);
   const attention=await fetch(`${origin}/v1/support/attention`,{headers:headers('admin')}),attentionBody=await attention.json();
   assert.equal(attention.status,200,JSON.stringify(attentionBody));assert.equal(attentionBody.critical_overdue,1);assert.equal(attentionBody.items[0].id,ticketId);
   assert.equal(attentionBody.externalDispatchAuthorized,false);assert.equal(attentionBody.automaticPauseAuthorized,false);
   // FC-323: only leadership may inspect a read-only route draft.
   const beforeOutbox=(await database.query('SELECT count(*)::int AS n FROM notification_outbox')).rows[0].n;
   const outsiderPreview=await fetch(`${origin}/v1/support/escalation-preview`,{headers:headers('owner')});assert.equal(outsiderPreview.status,403);
   const anonymousPreview=await fetch(`${origin}/v1/support/escalation-preview`);assert.equal(anonymousPreview.status,401);
   const otherSectorPreview=await fetch(`${origin}/v1/support/escalation-preview`,{headers:headers('second')});assert.equal(otherSectorPreview.status,403);
   const preview=await fetch(`${origin}/v1/support/escalation-preview`,{headers:headers('admin')});
   const previewBody=await preview.json();
   assert.equal(preview.status,200,JSON.stringify(previewBody));
   assert.equal(preview.headers.get('cache-control'),'no-store');
   assert.equal(previewBody.overdueTotal,1);
   assert.equal(previewBody.criticalOverdue,1);
   assert.equal(previewBody.routes[0].ticketId,ticketId);
   assert.equal(previewBody.routes[0].readiness,'missing_coverage');
   assert.deepEqual(previewBody.routes[0].missing,['primary','substitute','level4','level5']);
   assert.equal(previewBody.externalDispatchAuthorized,false);
   assert.equal(previewBody.internalDispatchAuthorized,false);
   assert.equal(previewBody.automaticPauseAuthorized,false);
   assert.equal(previewBody.sendAttempted,false);
   assert.equal(previewBody.preventionPreview.humanDecisionRequired,true);
   assert.equal((await database.query('SELECT count(*)::int AS n FROM support_duty_assignments')).rows[0].n,0);
   assert.equal((await database.query('SELECT count(*)::int AS n FROM notification_outbox')).rows[0].n,beforeOutbox);
   const customerPage=await fetch(`${root}?page=1`,{headers:headers('owner')});assert.equal(customerPage.status,200);
   const customerPageText=JSON.stringify(await customerPage.json());
   assert.equal(customerPageText.includes(noteInput.body),false);
   assert.equal(customerPageText.includes(ids.admin),false);
   const outsiderPage=await fetch(`${root}?page=1`,{headers:headers('outsider')});assert.equal(outsiderPage.status,200);
   assert.equal(JSON.stringify(await outsiderPage.json()).includes(ticketId),false);

   const customerReply=await fetch(`${root}/${ticketId}/reply`,{method:'POST',headers:headers('owner'),body:JSON.stringify({body:'Tentativa do cliente responder como equipe.',status:'under_review',idempotencyKey:'customer-support-reply-denied'})});assert.equal(customerReply.status,403);
   // Customer follow-ups must remain private, idempotent and distinct from staff replies.
   const followUp={body:'Acrescentando mais detalhes fictícios a este pedido.',idempotencyKey:'c1234567-1234-4234-8234-1234567890ab'};
   const outsiderMessage=await fetch(`${root}/${ticketId}/messages`,{method:'POST',headers:headers('outsider'),body:JSON.stringify(followUp)});assert.equal(outsiderMessage.status,404);
   const invalidCustomerMessage=await fetch(`${root}/${ticketId}/messages`,{method:'POST',headers:headers('owner'),body:JSON.stringify({...followUp,status:'resolved'})});assert.equal(invalidCustomerMessage.status,422);
   const sent=await fetch(`${root}/${ticketId}/messages`,{method:'POST',headers:headers('owner'),body:JSON.stringify(followUp)}),sentBody=await sent.json();assert.equal(sent.status,201,JSON.stringify(sentBody));assert.equal(sentBody.reused,false);assert.equal(sentBody.status,'under_review');
   const resend=await fetch(`${root}/${ticketId}/messages`,{method:'POST',headers:headers('owner'),body:JSON.stringify(followUp)});assert.equal(resend.status,200);assert.equal((await resend.json()).reused,true);
   const changed=await fetch(`${root}/${ticketId}/messages`,{method:'POST',headers:headers('owner'),body:JSON.stringify({...followUp,body:'Texto diferente com a mesma chave imutável.'})});assert.equal(changed.status,409);

   const firstReply={body:'Atendimento fictício assumido e colocado em análise.',status:'under_review',idempotencyKey:'support-reply-under-review'};
   const replied=await fetch(`${root}/${ticketId}/reply`,{method:'POST',headers:headers('admin'),body:JSON.stringify(firstReply)}),repliedBody=await replied.json();assert.equal(replied.status,200,JSON.stringify(repliedBody));assert.equal(repliedBody.reused,false);assert.equal(repliedBody.status,'under_review');
   const replyReplay=await fetch(`${root}/${ticketId}/reply`,{method:'POST',headers:headers('admin'),body:JSON.stringify(firstReply)});assert.equal(replyReplay.status,200);assert.equal((await replyReplay.json()).reused,true);
   const resolved=await fetch(`${root}/${ticketId}/reply`,{method:'POST',headers:headers('admin'),body:JSON.stringify({body:'Atendimento fictício encerrado sem executar ação financeira.',status:'resolved',idempotencyKey:'support-reply-resolved'})});assert.equal(resolved.status,200);assert.equal((await resolved.json()).status,'resolved');
   const customerDetail=await fetch(`${root}/${ticketId}`,{headers:headers('owner')}),customerBody=await customerDetail.json();assert.equal(customerDetail.status,200,JSON.stringify(customerBody));assert.equal(customerBody.ticket.status,'resolved');assert.equal(Object.hasOwn(customerBody.ticket,'internal_notes'),false);assert.equal(JSON.stringify(customerBody).includes(noteInput.body),false);assert.equal(customerBody.ticket.messages.length,3);
   assert.equal(customerBody.ticket.messages.some(message=>message.body===followUp.body&&message.mine===true),true);
   const closedFollowUp=await fetch(`${root}/${ticketId}/messages`,{method:'POST',headers:headers('owner'),body:JSON.stringify({...followUp,idempotencyKey:'d1234567-1234-4234-8234-1234567890ab'})});assert.equal(closedFollowUp.status,409);
   const safeRetry=await fetch(`${root}/${ticketId}/messages`,{method:'POST',headers:headers('owner'),body:JSON.stringify(followUp)});assert.equal(safeRetry.status,200);assert.equal((await safeRetry.json()).reused,true);
   const adminDetail=await fetch(`${root}/${ticketId}`,{headers:headers('admin')}),adminBody=await adminDetail.json();assert.equal(adminDetail.status,200,JSON.stringify(adminBody));assert.equal(adminBody.ticket.internal_notes.length,2);assert.equal(adminBody.ticket.internal_notes.some(note=>note.body===noteInput.body),true);assert.equal(adminBody.ticket.internal_notes.some(note=>note.body.includes('Classificação de criticidade: critical')),true);assert.equal(adminBody.ticket.messages.some(message=>message.body===followUp.body&&message.mine===false),true);
   const stored=(await database.query('SELECT status,assignee_id,first_response_at,first_response_due_at FROM support_tickets WHERE id=$1',[ticketId])).rows[0];assert.equal(stored.status,'resolved');assert.equal(stored.assignee_id,ids.admin);assert.ok(stored.first_response_at);assert.ok(stored.first_response_due_at);
   const attentionAfterReply=await fetch(`${origin}/v1/support/attention`,{headers:headers('admin')});assert.equal((await attentionAfterReply.json()).critical_overdue,0);
   assert.equal(Object.hasOwn(customerBody.ticket,'priority_classified_by'),false);
   const audits=(await database.query(`SELECT action,count(*)::int AS n FROM audit_events WHERE entity_id=$1 AND action IN('support.ticket.created','support.ticket.claimed','support.ticket.note_added','support.ticket.replied','support.ticket.customer_message','support.ticket.priority_classified') GROUP BY action ORDER BY action`,[ticketId])).rows;assert.deepEqual(audits,[{action:'support.ticket.claimed',n:1},{action:'support.ticket.created',n:1},{action:'support.ticket.customer_message',n:1},{action:'support.ticket.note_added',n:1},{action:'support.ticket.priority_classified',n:1},{action:'support.ticket.replied',n:2}]);
  }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
 });
});
