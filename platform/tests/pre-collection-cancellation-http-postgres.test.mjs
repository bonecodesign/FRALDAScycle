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
const ids={seller:'11111111-1111-4111-8111-111111111111',buyer:'22222222-2222-4222-8222-222222222222',admin:'33333333-3333-4333-8333-333333333333',freeListing:'44444444-4444-4444-8444-444444444444',paidListing:'55555555-5555-4555-8555-555555555555',freeTransaction:'66666666-6666-4666-8666-666666666666',paidTransaction:'77777777-7777-4777-8777-777777777777',intent:'88888888-8888-4888-8888-888888888888'};

test('pre-collection cancellation returns the listing and platform commission while provider work remains pending over HTTP/PostgreSQL',{
  skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const database=createDatabase({databaseUrl,databaseSsl:false});let api;
    try{
      await migrate(database,await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
        ($1,'cancel-seller@example.test','fixture','Vendedor fictício','customer'),
        ($2,'cancel-buyer@example.test','fixture','Comprador fictício','customer'),
        ($3,'cancel-admin@example.test','fixture','Admin fictício','admin')`,[ids.seller,ids.buyer,ids.admin]);
      await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,quantity,kind,price_cents,status) VALUES
        ($1,$2,'Venda fictícia sem pagamento','Pacote fictício cancelável diretamente.','infant','Pampers','Confort Sec','sealed',1,'sale',10000,'unavailable'),
        ($3,$2,'Venda fictícia paga','Pacote fictício cancelável pelo suporte.','infant','Pampers','Confort Sec','sealed',1,'sale',10000,'unavailable')`,[ids.freeListing,ids.seller,ids.paidListing]);
      await database.query(`INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents) VALUES
        ($1,$2,$3,$4,'initiated',10000),($5,$6,$3,$4,'paid',10000)`,[ids.freeTransaction,ids.freeListing,ids.buyer,ids.seller,ids.paidTransaction,ids.paidListing]);
      await database.query(`INSERT INTO payment_intents(id,transaction_id,buyer_id,idempotency_key,method,amount_cents,platform_fee_cents,delivery_fee_cents,seller_amount_cents,provider_reference,status)
        VALUES($1,$2,$3,'pre-collection-paid-intent','pix',10000,800,0,9200,'pre-collection-provider','paid')`,[ids.intent,ids.paidTransaction,ids.buyer]);
      const service=createMarketplaceService(createMarketplaceRepository(database));
      const actors={buyer:{id:ids.buyer,role:'customer'},admin:{id:ids.admin,role:'admin'}};
      api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),marketplaceService:service,authService:{async session(token){return actors[token]??null;}}});
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({cookie:`fc_session=${token}`,'content-type':'application/json'});
      const direct=await fetch(`${origin}/v1/transactions/${ids.freeTransaction}/cancel`,{method:'POST',headers:headers('buyer'),body:'{}'}),directBody=await direct.json();assert.equal(direct.status,200,JSON.stringify(directBody));assert.equal(directBody.transaction.status,'cancelled');assert.equal((await database.query('SELECT status FROM listings WHERE id=$1',[ids.freeListing])).rows[0].status,'published');
      const paidDirect=await fetch(`${origin}/v1/transactions/${ids.paidTransaction}/cancel`,{method:'POST',headers:headers('buyer'),body:'{}'});assert.equal(paidDirect.status,409);assert.equal((await paidDirect.json()).error.code,'cancellation_requires_support');
      const ticket=await fetch(`${origin}/v1/support/tickets`,{method:'POST',headers:headers('buyer'),body:JSON.stringify({category:'cancellation',subject:'Cancelar compra paga',details:'Solicito cancelamento fictício antes da coleta.',transactionId:ids.paidTransaction,idempotencyKey:'pre-collection-support-key'})}),ticketBody=await ticket.json();assert.equal(ticket.status,201,JSON.stringify(ticketBody));
      const previewDenied=await fetch(`${origin}/v1/support/tickets/${ticketBody.ticket.id}/cancellation-preview`,{headers:headers('buyer')});assert.equal(previewDenied.status,403);
      const preview=await fetch(`${origin}/v1/support/tickets/${ticketBody.ticket.id}/cancellation-preview`,{headers:headers('admin')}),previewBody=await preview.json();assert.equal(preview.status,200,JSON.stringify(previewBody));assert.equal(preview.headers.get('cache-control'),'no-store');assert.deepEqual(previewBody.preview,{phase:'pre_collection',grossAmountCents:10000,refundedPlatformFeeCents:800,retainedPlatformFeeCents:0,retainedDeliveryFeeCents:0,refundAmountCents:10000,providerStatus:'pending'});
      const decision=await fetch(`${origin}/v1/support/tickets/${ticketBody.ticket.id}/cancellation-decision`,{method:'POST',headers:headers('admin'),body:JSON.stringify({confirmed:true,reason:'Cancelamento fictício anterior à coleta, sem custo externo registrado.'})}),decisionBody=await decision.json();assert.equal(decision.status,201,JSON.stringify(decisionBody));assert.equal(decisionBody.cancellation.cancellation_phase,'pre_collection');assert.equal(decisionBody.cancellation.retained_platform_fee_cents,0);assert.equal(decisionBody.cancellation.refund_amount_cents,10000);assert.equal(decisionBody.cancellation.status,'provider_pending');
      const state=(await database.query('SELECT t.status,l.status AS listing_status FROM transactions t JOIN listings l ON l.id=t.listing_id WHERE t.id=$1',[ids.paidTransaction])).rows[0];assert.deepEqual(state,{status:'disputed',listing_status:'unavailable'});
      const audit=JSON.stringify((await database.query("SELECT action,metadata FROM audit_events WHERE entity_id=$1 ORDER BY id",[ids.paidTransaction])).rows);assert.equal(audit.includes('pre_collection'),true);assert.equal(audit.includes('Cancelamento fictício'),false);
    }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
  });
});
