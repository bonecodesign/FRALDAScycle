import test from 'node:test';
import assert from 'node:assert/strict';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {createOperationSupportRepository} from '../database/operation-support-repository.js';
import {createMarketplaceService} from '../apps/api/marketplace-service.js';
const native=await nativePostgresTools();
test('support pages and concurrent reply intents are safe in the fully migrated PostgreSQL schema',{skip:!native&&!process.env.CI,timeout:90000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{const database=createDatabase({databaseUrl,databaseSsl:false});try{
  await migrate(database,await discoverMigrations());
  const own='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333',second='44444444-4444-4444-8444-444444444444';
  for(const [index,user] of [own,other,admin,second].entries())await database.query("INSERT INTO users(id,email,password_hash,display_name) VALUES($1,$2,'synthetic-unusable-hash','Pessoa fictícia')",[user,`synthetic-support-${index}@example.test`]);
  await database.query(`INSERT INTO support_tickets(requester_id,category,subject,details,idempotency_key,created_at)
   SELECT CASE WHEN n<=60 THEN $1::uuid ELSE $2::uuid END,'general','Assunto fictício','Descrição fictícia para paginação','synthetic-support-ticket-'||n,'2026-10-09T12:00:00Z'::timestamptz FROM generate_series(1,120) n`,[own,other]);
  await database.query(`UPDATE support_tickets SET status=CASE WHEN protocol%3=0 THEN 'resolved' WHEN protocol%3=1 THEN 'open' ELSE 'under_review' END,category=CASE WHEN protocol%5=0 THEN 'privacy' ELSE 'general' END WHERE requester_id=$1`,[own]);
  await database.query(`UPDATE support_tickets SET details='Descrição literal 100% e _underscore.' WHERE id=(SELECT id FROM support_tickets WHERE requester_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1)`,[own]);
  const service=createMarketplaceService(createOperationSupportRepository(database)),actor={id:admin,role:'admin'};
  const first=await service.supportPage({id:own,role:'customer'},{page:'1'}),next=await service.supportPage({id:own,role:'customer'},{page:'2'});
  assert.equal(first.items.length,50);assert.equal(first.hasMore,true);assert.equal(next.items.length,10);assert.equal(next.hasMore,false);assert.equal(new Set([...first.items,...next.items].map(row=>row.id)).size,60);assert.equal((await service.supportPage({id:own,role:'customer'},{page:'3'})).items.length,0);
  const foreign=await service.supportPage({id:other,role:'customer'});assert.equal(foreign.items.some(row=>first.items.some(own=>own.id===row.id)),false);
  const all=await Promise.all(['1','2','3'].map(page=>service.supportPage(actor,{page})));assert.deepEqual(all.map(page=>page.items.length),[50,50,20]);assert.equal(new Set(all.flatMap(page=>page.items.map(row=>row.id))).size,120);
  const filtered=await service.supportPage(actor,{status:'resolved',category:'privacy'});assert.ok(filtered.items.length>0);assert.ok(filtered.items.every(row=>row.status==='resolved'&&row.category==='privacy'));const literal=await service.supportPage(actor,{q:'100% e _underscore'});assert.equal(literal.items.length,1);assert.equal((await database.query(`SELECT count(*)::integer AS count FROM support_tickets WHERE requester_id=$1 AND status='resolved' AND category='privacy'`,[own])).rows[0].count, (await service.supportPage({id:admin,role:'admin'},{status:'resolved',category:'privacy'})).items.length);
  const ticket=first.items[0].id,another=first.items[1].id,input={body:'Resposta fictícia concorrente',status:'under_review',idempotencyKey:'synthetic-support-reply-one'};
  const replies=await Promise.all(Array.from({length:5},()=>service.replySupportTicket(actor,ticket,input)));assert.equal(replies.filter(reply=>!reply.reused).length,1);assert.equal(new Set(replies.map(reply=>reply.messageId)).size,1);
  assert.equal((await database.query('SELECT count(*)::integer AS count FROM support_ticket_messages WHERE ticket_id=$1',[ticket])).rows[0].count,1);
  assert.equal((await database.query("SELECT count(*)::integer AS count FROM audit_events WHERE action='support.ticket.replied' AND entity_id=$1",[ticket])).rows[0].count,1);
  await service.replySupportTicket(actor,ticket,{...input,body:'Resposta fictícia de encerramento',status:'resolved',idempotencyKey:'synthetic-support-reply-two'});
  const replay=await service.replySupportTicket(actor,ticket,input);assert.equal(replay.reused,true);assert.equal((await database.query('SELECT status FROM support_tickets WHERE id=$1',[ticket])).rows[0].status,'resolved');
  for(const [target,changed] of [[ticket,{body:'Outro conteúdo fictício'}],[ticket,{status:'open'}],[another,{}]])await assert.rejects(service.replySupportTicket(actor,target,{...input,...changed}),error=>error.code==='support_reply_key_conflict');
  const cross=await Promise.allSettled([service.replySupportTicket(actor,ticket,{...input,idempotencyKey:'synthetic-support-cross-key'}),service.replySupportTicket(actor,another,{...input,idempotencyKey:'synthetic-support-cross-key'})]);assert.equal(cross.filter(result=>result.status==='fulfilled').length,1);assert.equal(cross.find(result=>result.status==='rejected').reason.code,'support_reply_key_conflict');
  assert.equal((await service.replySupportTicket({id:second,role:'admin'},ticket,input)).reused,false);
  await assert.rejects(service.replySupportTicket({id:own,role:'customer'},ticket,input),error=>error.status===403);
 }finally{await database.close();}});
});
