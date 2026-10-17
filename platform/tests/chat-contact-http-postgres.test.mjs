import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createCommunicationsService} from '../apps/api/communications-service.js';
import {createMarketplaceService} from '../apps/api/marketplace-service.js';
import {createModerationService} from '../apps/api/moderation-service.js';
import {createCommunicationsRepository} from '../database/communications-repository.js';
import {createDatabase} from '../database/client.js';
import {createMarketplaceRepository} from '../database/marketplace-repository.js';
import {createModerationRepository} from '../database/moderation-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const ids={seller:'11111111-1111-4111-8111-111111111111',buyer:'22222222-2222-4222-8222-222222222222',admin:'33333333-3333-4333-8333-333333333333',listing:'44444444-4444-4444-8444-444444444444',transaction:'55555555-5555-4555-8555-555555555555'};

test('paid chat blocks contact patterns and grants only an exact reviewed exception over HTTP/PostgreSQL',{
  skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const database=createDatabase({databaseUrl,databaseSsl:false});let api;
    try{
      await migrate(database,await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
        ($1,'chat-seller@example.test','fixture','Vendedor fictício','customer'),
        ($2,'chat-buyer@example.test','fixture','Comprador fictício','customer'),
        ($3,'chat-admin@example.test','fixture','Moderador fictício','moderator')`,[ids.seller,ids.buyer,ids.admin]);
      await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,quantity,kind,price_cents,status)
        VALUES($1,$2,'Venda fictícia no chat','Pacote fictício para validar contatos no chat.','infant','Pampers','Confort Sec','sealed',1,'sale',10000,'unavailable')`,[ids.listing,ids.seller]);
      await database.query("INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents) VALUES($1,$2,$3,$4,'paid',10000)",[ids.transaction,ids.listing,ids.buyer,ids.seller]);
      const moderationRepository=createModerationRepository(database),moderationService=createModerationService(moderationRepository);
      const actors={seller:{id:ids.seller,role:'customer'},buyer:{id:ids.buyer,role:'customer'},admin:{id:ids.admin,role:'moderator'}};
      api=createApiServer({
        config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),
        marketplaceService:createMarketplaceService(createMarketplaceRepository(database),moderationRepository),
        communicationsService:createCommunicationsService(createCommunicationsRepository(database),moderationRepository),
        moderationService,
        authService:{async session(token){return actors[token]??null;}},
      });
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({cookie:`fc_session=${token}`,'content-type':'application/json'}),messagesUrl=`${origin}/v1/transactions/${ids.transaction}/messages`;
      const unpaidAccess=await (await fetch(`${origin}/v1/transactions/${ids.transaction}/chat-access`,{headers:headers('buyer')})).json();assert.equal(unpaidAccess.allowed,false);assert.equal(unpaidAccess.reason,'payment_not_confirmed');
      const unpaidMessage=await fetch(messagesUrl,{method:'POST',headers:headers('buyer'),body:JSON.stringify({body:'O pacote está pronto para coleta.',idempotencyKey:'chat-before-payment'})});assert.equal(unpaidMessage.status,409);
      await database.query(`INSERT INTO payment_intents(transaction_id,buyer_id,idempotency_key,method,amount_cents,platform_fee_cents,delivery_fee_cents,seller_amount_cents,provider_reference,status)
        VALUES($1,$2,'chat-paid-intent','pix',10000,800,0,9200,'chat-paid-reference','paid')`,[ids.transaction,ids.buyer]);
      const paidAccess=await (await fetch(`${origin}/v1/transactions/${ids.transaction}/chat-access`,{headers:headers('buyer')})).json();assert.equal(paidAccess.allowed,true);assert.equal(paidAccess.reason,'payment_confirmed');
      const ordinary={body:'O pacote está pronto para coleta.',idempotencyKey:'chat-ordinary-message'};
      const sent=await fetch(messagesUrl,{method:'POST',headers:headers('buyer'),body:JSON.stringify(ordinary)}),sentBody=await sent.json();assert.equal(sent.status,200,JSON.stringify(sentBody));assert.equal(sentBody.reused,false);
      const repeated=await fetch(messagesUrl,{method:'POST',headers:headers('buyer'),body:JSON.stringify(ordinary)});assert.equal((await repeated.json()).reused,true);
      const blocked=[['fake@example.test','chat-email-blocked'],['Meu telefone é +55 31 99999-0000','chat-phone-blocked'],['Me chama no insta para combinar','chat-external-blocked']];
      for(const [body,idempotencyKey] of blocked){const response=await fetch(messagesUrl,{method:'POST',headers:headers('buyer'),body:JSON.stringify({body,idempotencyKey})});assert.equal(response.status,422);assert.equal((await response.json()).error.code,'content_requires_moderation');}
      const barcode='Lote fictício 12345678 da embalagem.',barcodeKey='chat-reviewed-barcode';
      const barcodeBlocked=await fetch(messagesUrl,{method:'POST',headers:headers('buyer'),body:JSON.stringify({body:barcode,idempotencyKey:barcodeKey})});assert.equal(barcodeBlocked.status,422);
      const decisions=await (await fetch(`${origin}/v1/moderation/decisions`,{headers:headers('buyer')})).json();
      const decision=decisions.items.find(item=>item.surface==='chat'&&item.status==='blocked');assert.ok(decision);
      const appeal=await fetch(`${origin}/v1/moderation/decisions/${decision.id}/appeal`,{method:'POST',headers:headers('buyer'),body:JSON.stringify({body:'O número representa somente o lote fictício da embalagem.'})});assert.equal(appeal.status,200,await appeal.text());
      const wrongReview=await fetch(`${origin}/v1/moderation/decisions/${decision.id}/review`,{method:'POST',headers:headers('admin'),body:JSON.stringify({outcome:'overturned',reason:'Revisão fictícia de falso positivo.',confirmed:true,reviewedText:'Outro texto'})});assert.equal(wrongReview.status,422);
      const exactReview=await fetch(`${origin}/v1/moderation/decisions/${decision.id}/review`,{method:'POST',headers:headers('admin'),body:JSON.stringify({outcome:'overturned',reason:'Revisão fictícia de falso positivo.',confirmed:true,reviewedText:barcode})});assert.equal(exactReview.status,200,await exactReview.text());
      const accepted=await fetch(messagesUrl,{method:'POST',headers:headers('buyer'),body:JSON.stringify({body:barcode,idempotencyKey:barcodeKey})});assert.equal(accepted.status,200,await accepted.text());
      const stored=(await database.query('SELECT body FROM transaction_messages WHERE transaction_id=$1 ORDER BY created_at,id',[ids.transaction])).rows;assert.deepEqual(stored.map(row=>row.body),[ordinary.body,barcode]);
      const audit=JSON.stringify((await database.query("SELECT metadata FROM audit_events WHERE action IN ('moderation.content.blocked','chat.message.created')")).rows);for(const [body] of blocked)assert.equal(audit.includes(body),false);
    }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
  });
});
