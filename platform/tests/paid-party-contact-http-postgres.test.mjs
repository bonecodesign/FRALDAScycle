import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createMarketplaceService} from '../apps/api/marketplace-service.js';
import {createDatabase} from '../database/client.js';
import {createMarketplaceRepository} from '../database/marketplace-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {createPaymentRepository} from '../database/payment-repository.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const ids={seller:'11111111-1111-4111-8111-111111111111',buyer:'22222222-2222-4222-8222-222222222222',other:'33333333-3333-4333-8333-333333333333',admin:'44444444-4444-4444-8444-444444444444',listing:'55555555-5555-4555-8555-555555555555',transaction:'66666666-6666-4666-8666-666666666666',intent:'77777777-7777-4777-8777-777777777777'};

test('verified party contact unlocks after paid webhook and is revoked by supported cancellation over HTTP/PostgreSQL',{
  skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const database=createDatabase({databaseUrl,databaseSsl:false});let api;
    try{
      await migrate(database,await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,phone,password_hash,display_name,role,email_verified_at,phone_verified_at) VALUES
        ($1,'party-seller@example.test','+5531999990001','fixture','Vendedor fictício','customer',now(),NULL),
        ($2,'party-buyer@example.test','+5531999990002','fixture','Comprador fictício','customer',now(),now()),
        ($3,'party-other@example.test','+5531999990003','fixture','Pessoa externa','customer',now(),now()),
        ($4,'party-admin@example.test','+5531999990004','fixture','Admin fictício','admin',now(),now())`,[ids.seller,ids.buyer,ids.other,ids.admin]);
      await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,quantity,kind,price_cents,status)
        VALUES($1,$2,'Venda fictícia com contato','Pacote fictício para contato pós-pagamento.','infant','Pampers','Confort Sec','sealed',1,'sale',10000,'unavailable')`,[ids.listing,ids.seller]);
      await database.query("INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents) VALUES($1,$2,$3,$4,'payment_pending',10000)",[ids.transaction,ids.listing,ids.buyer,ids.seller]);
      await database.query(`INSERT INTO payment_intents(id,transaction_id,buyer_id,idempotency_key,method,amount_cents,platform_fee_cents,delivery_fee_cents,seller_amount_cents,provider_reference,status)
        VALUES($1,$2,$3,'party-contact-payment','pix',10000,800,0,9200,'party-contact-provider','provider_pending')`,[ids.intent,ids.transaction,ids.buyer]);
      const marketplaceService=createMarketplaceService(createMarketplaceRepository(database));
      const actors={seller:{id:ids.seller,role:'customer'},buyer:{id:ids.buyer,role:'customer'},other:{id:ids.other,role:'customer'},admin:{id:ids.admin,role:'admin'}};
      api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),marketplaceService,authService:{async session(token){return actors[token]??null;}}});
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({cookie:`fc_session=${token}`,'content-type':'application/json'}),contactUrl=`${origin}/v1/transactions/${ids.transaction}/contact`;
      const before=await fetch(contactUrl,{headers:headers('buyer')});assert.equal(before.status,409);assert.equal((await before.json()).error.code,'contact_not_available');
      const payment=await createPaymentRepository(database).processWebhook({id:'party-contact-paid-event',type:'payment.paid',providerReference:'party-contact-provider',occurredAt:new Date().toISOString(),payloadHash:'party-contact-paid-hash',amountCents:10000});assert.equal(payment.status,'paid');
      const paidWithoutConsent=await fetch(contactUrl,{headers:headers('buyer')});assert.equal(paidWithoutConsent.status,409);assert.equal((await paidWithoutConsent.json()).error.code,'contact_not_available');
      const authorizationUrl=`${origin}/v1/transactions/${ids.transaction}/contact-authorization`;
      const initialAuthorization=await fetch(authorizationUrl,{headers:headers('seller')}),initialAuthorizationBody=await initialAuthorization.json();assert.equal(initialAuthorization.status,200);assert.deepEqual(initialAuthorizationBody.authorization,{emailAllowed:false,phoneAllowed:false,version:0,revoked:false});assert.equal(initialAuthorization.headers.get('cache-control'),'no-store');
      const outsiderAuthorization=await fetch(authorizationUrl,{method:'PUT',headers:headers('other'),body:JSON.stringify({emailAllowed:true,phoneAllowed:true,confirmed:true,expectedVersion:0})});assert.equal(outsiderAuthorization.status,409);
      const sellerAuthorization=await fetch(authorizationUrl,{method:'PUT',headers:headers('seller'),body:JSON.stringify({emailAllowed:true,phoneAllowed:false,confirmed:true,expectedVersion:0})});assert.equal(sellerAuthorization.status,200);assert.deepEqual((await sellerAuthorization.json()).authorization,{emailAllowed:true,phoneAllowed:false,version:1,revoked:false});
      const buyerAuthorization=await fetch(authorizationUrl,{method:'PUT',headers:headers('buyer'),body:JSON.stringify({emailAllowed:true,phoneAllowed:true,confirmed:true,expectedVersion:0})});assert.equal(buyerAuthorization.status,200);
      const buyerRead=await fetch(contactUrl,{headers:headers('buyer')}),buyerBody=await buyerRead.json();assert.equal(buyerRead.status,200,JSON.stringify(buyerBody));assert.equal(buyerRead.headers.get('cache-control'),'no-store');assert.equal(buyerBody.contact.displayName,'Vendedor fictício');assert.equal(buyerBody.contact.email,'party-seller@example.test');assert.equal(buyerBody.contact.phone,undefined);
      const sellerRead=await fetch(contactUrl,{headers:headers('seller')}),sellerBody=await sellerRead.json();assert.equal(sellerRead.status,200,JSON.stringify(sellerBody));assert.deepEqual({email:sellerBody.contact.email,phone:sellerBody.contact.phone},{email:'party-buyer@example.test',phone:'+5531999990002'});
      const unrelated=await fetch(contactUrl,{headers:headers('other')});assert.equal(unrelated.status,409);assert.equal((await unrelated.json()).error.code,'contact_not_available');
      const revokedByHolder=await fetch(authorizationUrl,{method:'PUT',headers:headers('buyer'),body:JSON.stringify({emailAllowed:false,phoneAllowed:false,confirmed:true,expectedVersion:1})});assert.equal(revokedByHolder.status,200);assert.equal((await revokedByHolder.json()).authorization.revoked,true);
      assert.equal((await fetch(contactUrl,{headers:headers('seller')})).status,409);
      assert.equal((await fetch(authorizationUrl,{method:'PUT',headers:headers('buyer'),body:JSON.stringify({emailAllowed:true,phoneAllowed:true,confirmed:true,expectedVersion:1})})).status,409);
      assert.equal((await fetch(authorizationUrl,{method:'PUT',headers:headers('buyer'),body:JSON.stringify({emailAllowed:true,phoneAllowed:true,confirmed:true,expectedVersion:2})})).status,200);
      const support=await fetch(`${origin}/v1/support/tickets`,{method:'POST',headers:headers('buyer'),body:JSON.stringify({category:'cancellation',subject:'Cancelar operação paga',details:'Solicito cancelamento assistido da operação fictícia.',transactionId:ids.transaction,idempotencyKey:'party-contact-cancellation'})}),supportBody=await support.json();assert.equal(support.status,201,JSON.stringify(supportBody));
      const decision=await fetch(`${origin}/v1/support/tickets/${supportBody.ticket.id}/cancellation-decision`,{method:'POST',headers:headers('admin'),body:JSON.stringify({confirmed:true,reason:'Cancelamento fictício aprovado com taxas registradas.'})});assert.equal(decision.status,201,await decision.text());
      const revoked=await fetch(contactUrl,{headers:headers('buyer')});assert.equal(revoked.status,409);assert.equal((await revoked.json()).error.code,'contact_not_available');
      const access=(await database.query('SELECT revoked_at,revocation_reason FROM transaction_contact_access WHERE transaction_id=$1',[ids.transaction])).rows[0];assert.ok(access.revoked_at);assert.equal(access.revocation_reason,'supported_cancellation');
      const audits=(await database.query("SELECT metadata FROM audit_events WHERE action='transaction.contact.read' AND entity_id=$1 ORDER BY id",[ids.transaction])).rows;assert.deepEqual(audits.map(row=>row.metadata),[{channels:['email']},{channels:['phone','email']}]);const serialized=JSON.stringify(audits);assert.equal(serialized.includes('party-seller@example.test'),false);assert.equal(serialized.includes('+5531999990002'),false);
      const authorizationAudits=JSON.stringify((await database.query("SELECT metadata FROM audit_events WHERE action LIKE 'transaction.contact.authorization.%' AND entity_id=$1 ORDER BY id",[ids.transaction])).rows);assert.equal(authorizationAudits.includes('party-buyer@example.test'),false);assert.equal(authorizationAudits.includes('+5531999990002'),false);
    }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
  });
});
