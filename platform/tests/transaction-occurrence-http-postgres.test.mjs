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
const ids={seller:'11111111-1111-4111-8111-111111111111',buyer:'22222222-2222-4222-8222-222222222222',outsider:'33333333-3333-4333-8333-333333333333',admin:'44444444-4444-4444-8444-444444444444',listing:'55555555-5555-4555-8555-555555555555',transaction:'66666666-6666-4666-8666-666666666666',intent:'77777777-7777-4777-8777-777777777777'};

test('transaction occurrence blocks settlement until an explicit scoped decision over HTTP/PostgreSQL',{
  skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const database=createDatabase({databaseUrl,databaseSsl:false});let api;
    try{
      await migrate(database,await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
        ($1,'occurrence-seller@example.test','fixture','Vendedor fictício','customer'),
        ($2,'occurrence-buyer@example.test','fixture','Comprador fictício','customer'),
        ($3,'occurrence-outsider@example.test','fixture','Pessoa externa','customer'),
        ($4,'occurrence-admin@example.test','fixture','Admin fictício','admin')`,[ids.seller,ids.buyer,ids.outsider,ids.admin]);
      await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,quantity,kind,price_cents,status)
        VALUES($1,$2,'Venda fictícia divergente','Pacote fictício para analisar divergência.','infant','Pampers','Confort Sec','sealed',1,'sale',10000,'unavailable')`,[ids.listing,ids.seller]);
      await database.query("INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents) VALUES($1,$2,$3,$4,'in_delivery',10000)",[ids.transaction,ids.listing,ids.buyer,ids.seller]);
      await database.query(`INSERT INTO payment_intents(id,transaction_id,buyer_id,idempotency_key,method,amount_cents,platform_fee_cents,delivery_fee_cents,seller_amount_cents,provider_reference,status)
        VALUES($1,$2,$3,'occurrence-paid-intent','pix',10000,800,0,9200,'occurrence-provider','paid')`,[ids.intent,ids.transaction,ids.buyer]);
      const service=createMarketplaceService(createMarketplaceRepository(database));
      const actors={seller:{id:ids.seller,role:'customer'},buyer:{id:ids.buyer,role:'customer'},outsider:{id:ids.outsider,role:'customer'},admin:{id:ids.admin,role:'admin'}};
      api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),marketplaceService:service,authService:{async session(token){return actors[token]??null;}}});
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({cookie:`fc_session=${token}`,'content-type':'application/json'}),tickets=`${origin}/v1/support/tickets`;
      const payload={category:'receipt_problem',occurrenceKind:'damaged_package',subject:'Embalagem danificada',details:'A embalagem fictícia chegou danificada e precisa de análise.',transactionId:ids.transaction,idempotencyKey:'occurrence-http-postgres-key'};
      const outsider=await fetch(tickets,{method:'POST',headers:headers('outsider'),body:JSON.stringify(payload)});assert.equal(outsider.status,404);
      const invalid=await fetch(tickets,{method:'POST',headers:headers('buyer'),body:JSON.stringify({...payload,occurrenceKind:'unsupported'})});assert.equal(invalid.status,422);
      const created=await fetch(tickets,{method:'POST',headers:headers('buyer'),body:JSON.stringify(payload)}),createdBody=await created.json();assert.equal(created.status,201,JSON.stringify(createdBody));const ticketId=createdBody.ticket.id;
      const repeated=await fetch(tickets,{method:'POST',headers:headers('buyer'),body:JSON.stringify(payload)});assert.equal(repeated.status,200);assert.equal((await repeated.json()).reused,true);
      const changedReplay=await fetch(tickets,{method:'POST',headers:headers('buyer'),body:JSON.stringify({...payload,occurrenceKind:'not_received'})});assert.equal(changedReplay.status,409);assert.equal((await changedReplay.json()).error.code,'support_key_conflict');
      assert.equal((await database.query('SELECT status FROM transactions WHERE id=$1',[ids.transaction])).rows[0].status,'disputed');
      const occurrence=(await database.query('SELECT kind,status,prior_transaction_status FROM transaction_occurrences WHERE support_ticket_id=$1',[ticketId])).rows[0];assert.deepEqual(occurrence,{kind:'damaged_package',status:'under_review',prior_transaction_status:'in_delivery'});
      const generic=await fetch(`${tickets}/${ticketId}/reply`,{method:'POST',headers:headers('admin'),body:JSON.stringify({body:'Tentativa fictícia de encerrar sem decisão própria.',status:'resolved',idempotencyKey:'occurrence-generic-reply'})});assert.equal(generic.status,409);assert.equal((await generic.json()).error.code,'occurrence_decision_required');
      const forbidden=await fetch(`${tickets}/${ticketId}/occurrence-decision`,{method:'POST',headers:headers('buyer'),body:JSON.stringify({confirmed:true,outcome:'refund_required',reason:'Reembolso fictício indicado após análise registrada.'})});assert.equal(forbidden.status,403);
      const decisionInput={confirmed:true,outcome:'refund_required',reason:'Reembolso fictício indicado após análise registrada.'};
      const decided=await fetch(`${tickets}/${ticketId}/occurrence-decision`,{method:'POST',headers:headers('admin'),body:JSON.stringify(decisionInput)});assert.equal(decided.status,201,await decided.text());
      const replay=await fetch(`${tickets}/${ticketId}/occurrence-decision`,{method:'POST',headers:headers('admin'),body:JSON.stringify(decisionInput)});assert.equal(replay.status,200);assert.equal((await replay.json()).reused,true);
      const conflict=await fetch(`${tickets}/${ticketId}/occurrence-decision`,{method:'POST',headers:headers('admin'),body:JSON.stringify({...decisionInput,outcome:'dismissed'})});assert.equal(conflict.status,409);
      const final=(await database.query(`SELECT o.status,o.outcome,t.status AS transaction_status,st.status AS ticket_status FROM transaction_occurrences o JOIN transactions t ON t.id=o.transaction_id JOIN support_tickets st ON st.id=o.support_ticket_id WHERE o.support_ticket_id=$1`,[ticketId])).rows[0];assert.deepEqual(final,{status:'resolved',outcome:'refund_required',transaction_status:'disputed',ticket_status:'resolved'});
      const audit=JSON.stringify((await database.query("SELECT action,metadata FROM audit_events WHERE entity_id IN ($1::text,(SELECT id::text FROM transaction_occurrences WHERE support_ticket_id=$1::uuid)) ORDER BY id",[ticketId])).rows);assert.equal(audit.includes(decisionInput.reason),false);assert.equal(audit.includes('refund_required'),true);
    }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
  });
});
