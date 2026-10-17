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
const ids={seller:'11111111-1111-4111-8111-111111111111',buyer:'22222222-2222-4222-8222-222222222222',courier:'33333333-3333-4333-8333-333333333333',admin:'44444444-4444-4444-8444-444444444444',listing:'55555555-5555-4555-8555-555555555555',transaction:'66666666-6666-4666-8666-666666666666',intent:'77777777-7777-4777-8777-777777777777',shipment:'88888888-8888-4888-8888-888888888888'};

test('post-collection cancellation stays in support without reverting shipment, listing or claiming a refund over HTTP/PostgreSQL',{
  skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const database=createDatabase({databaseUrl,databaseSsl:false});let api;
    try{
      await migrate(database,await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
        ($1,'post-seller@example.test','fixture','Vendedor fictício','customer'),
        ($2,'post-buyer@example.test','fixture','Comprador fictício','customer'),
        ($3,'post-courier@example.test','fixture','Entregador fictício','courier'),
        ($4,'post-admin@example.test','fixture','Admin fictício','admin')`,[ids.seller,ids.buyer,ids.courier,ids.admin]);
      await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,quantity,kind,price_cents,status)
        VALUES($1,$2,'Venda fictícia coletada','Pacote fictício já coletado para suporte.','infant','Pampers','Confort Sec','sealed',1,'sale',10000,'unavailable')`,[ids.listing,ids.seller]);
      await database.query("INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents,address_shared_at) VALUES($1,$2,$3,$4,'in_delivery',10000,now())",[ids.transaction,ids.listing,ids.buyer,ids.seller]);
      await database.query(`INSERT INTO payment_intents(id,transaction_id,buyer_id,idempotency_key,method,amount_cents,platform_fee_cents,delivery_fee_cents,seller_amount_cents,provider_reference,status)
        VALUES($1,$2,$3,'post-collection-paid-intent','pix',10000,800,0,9200,'post-collection-provider','paid')`,[ids.intent,ids.transaction,ids.buyer]);
      await database.query("INSERT INTO shipments(id,transaction_id,buyer_id,seller_id,courier_id,mode,insured,idempotency_key,status) VALUES($1,$2,$3,$4,$5,'partner',false,'post-collection-shipment','picked_up')",[ids.shipment,ids.transaction,ids.buyer,ids.seller,ids.courier]);
      await database.query("INSERT INTO shipment_events(shipment_id,status,description) VALUES($1,'picked_up','Coleta fictícia registrada.')",[ids.shipment]);
      const service=createMarketplaceService(createMarketplaceRepository(database));
      const actors={buyer:{id:ids.buyer,role:'customer'},admin:{id:ids.admin,role:'admin'}};
      api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),marketplaceService:service,authService:{async session(token){return actors[token]??null;}}});
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({cookie:`fc_session=${token}`,'content-type':'application/json'});
      const direct=await fetch(`${origin}/v1/transactions/${ids.transaction}/cancel`,{method:'POST',headers:headers('buyer'),body:'{}'});assert.equal(direct.status,409);assert.equal((await direct.json()).error.code,'cancellation_requires_support');
      const ticket=await fetch(`${origin}/v1/support/tickets`,{method:'POST',headers:headers('buyer'),body:JSON.stringify({category:'cancellation',subject:'Analisar operação coletada',details:'Solicito análise fictícia depois da coleta registrada.',transactionId:ids.transaction,idempotencyKey:'post-collection-support-key'})}),ticketBody=await ticket.json();assert.equal(ticket.status,201,JSON.stringify(ticketBody));
      const preview=await fetch(`${origin}/v1/support/tickets/${ticketBody.ticket.id}/cancellation-preview`,{headers:headers('admin')}),previewBody=await preview.json();assert.equal(preview.status,200,JSON.stringify(previewBody));assert.deepEqual(previewBody.preview,{phase:'post_milestone',grossAmountCents:10000,refundedPlatformFeeCents:0,retainedPlatformFeeCents:800,retainedDeliveryFeeCents:0,refundAmountCents:9200,providerStatus:'pending'});
      const decision=await fetch(`${origin}/v1/support/tickets/${ticketBody.ticket.id}/cancellation-decision`,{method:'POST',headers:headers('admin'),body:JSON.stringify({confirmed:true,reason:'Análise fictícia pós-coleta encaminhada ao provedor.'})}),decisionBody=await decision.json();assert.equal(decision.status,201,JSON.stringify(decisionBody));assert.equal(decisionBody.cancellation.cancellation_phase,'post_milestone');assert.equal(decisionBody.cancellation.status,'provider_pending');
      const state=(await database.query(`SELECT t.status AS transaction_status,l.status AS listing_status,s.status AS shipment_status FROM transactions t JOIN listings l ON l.id=t.listing_id JOIN shipments s ON s.transaction_id=t.id WHERE t.id=$1`,[ids.transaction])).rows[0];assert.deepEqual(state,{transaction_status:'disputed',listing_status:'unavailable',shipment_status:'picked_up'});
      assert.equal((await database.query("SELECT count(*)::integer AS n FROM payment_cases WHERE payment_intent_id=$1 AND status='completed'",[ids.intent])).rows[0].n,0);
      const audit=JSON.stringify((await database.query('SELECT action,metadata FROM audit_events WHERE entity_id=$1 ORDER BY id',[ids.transaction])).rows);assert.equal(audit.includes('post_milestone'),true);assert.equal(audit.includes('Análise fictícia'),false);
    }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
  });
});
