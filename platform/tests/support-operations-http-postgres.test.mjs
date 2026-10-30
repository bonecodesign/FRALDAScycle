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
   const actors={owner:{id:ids.owner,role:'customer'},outsider:{id:ids.outsider,role:'customer'},admin:{id:ids.admin,role:'admin'},second:{id:ids.secondAdmin,role:'admin'}};
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
   const customerReply=await fetch(`${root}/${ticketId}/reply`,{method:'POST',headers:headers('owner'),body:JSON.stringify({body:'Tentativa do cliente responder como equipe.',status:'under_review',idempotencyKey:'customer-support-reply-denied'})});assert.equal(customerReply.status,403);
   const firstReply={body:'Atendimento fictício assumido e colocado em análise.',status:'under_review',idempotencyKey:'support-reply-under-review'};
   const replied=await fetch(`${root}/${ticketId}/reply`,{method:'POST',headers:headers('admin'),body:JSON.stringify(firstReply)}),repliedBody=await replied.json();assert.equal(replied.status,200,JSON.stringify(repliedBody));assert.equal(repliedBody.reused,false);assert.equal(repliedBody.status,'under_review');
   const replyReplay=await fetch(`${root}/${ticketId}/reply`,{method:'POST',headers:headers('admin'),body:JSON.stringify(firstReply)});assert.equal(replyReplay.status,200);assert.equal((await replyReplay.json()).reused,true);
   const resolved=await fetch(`${root}/${ticketId}/reply`,{method:'POST',headers:headers('admin'),body:JSON.stringify({body:'Atendimento fictício encerrado sem executar ação financeira.',status:'resolved',idempotencyKey:'support-reply-resolved'})});assert.equal(resolved.status,200);assert.equal((await resolved.json()).status,'resolved');
   const customerDetail=await fetch(`${root}/${ticketId}`,{headers:headers('owner')}),customerBody=await customerDetail.json();assert.equal(customerDetail.status,200,JSON.stringify(customerBody));assert.equal(customerBody.ticket.status,'resolved');assert.equal(Object.hasOwn(customerBody.ticket,'internal_notes'),false);assert.equal(JSON.stringify(customerBody).includes(noteInput.body),false);assert.equal(customerBody.ticket.messages.length,2);
   const adminDetail=await fetch(`${root}/${ticketId}`,{headers:headers('admin')}),adminBody=await adminDetail.json();assert.equal(adminDetail.status,200,JSON.stringify(adminBody));assert.equal(adminBody.ticket.internal_notes.length,1);assert.equal(adminBody.ticket.internal_notes[0].body,noteInput.body);
   const stored=(await database.query('SELECT status,assignee_id FROM support_tickets WHERE id=$1',[ticketId])).rows[0];assert.deepEqual(stored,{status:'resolved',assignee_id:ids.admin});
   const audits=(await database.query(`SELECT action,count(*)::int AS n FROM audit_events WHERE entity_id=$1 AND action IN('support.ticket.created','support.ticket.claimed','support.ticket.note_added','support.ticket.replied') GROUP BY action ORDER BY action`,[ticketId])).rows;assert.deepEqual(audits,[{action:'support.ticket.claimed',n:1},{action:'support.ticket.created',n:1},{action:'support.ticket.note_added',n:1},{action:'support.ticket.replied',n:2}]);
  }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
 });
});
