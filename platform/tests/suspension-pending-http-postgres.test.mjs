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
const ids={user:'11111111-1111-4111-8111-111111111111',seller:'22222222-2222-4222-8222-222222222222',admin:'33333333-3333-4333-8333-333333333333',ownListing:'44444444-4444-4444-8444-444444444444',listing:'55555555-5555-4555-8555-555555555555',transaction:'66666666-6666-4666-8666-666666666666'};

test('temporary suspension blocks new operations but preserves existing follow-up and support over HTTP/PostgreSQL',{
  skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const database=createDatabase({databaseUrl,databaseSsl:false});let api;
    try{
      await migrate(database,await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name,role,email_verified_at,adult_declared_at,adult_declaration_version) VALUES
        ($1,'suspended-user@example.test','fixture','Pessoa suspensa','customer',now(),now(),'FC-AGE-1'),
        ($2,'suspension-seller@example.test','fixture','Vendedor fictício','customer',now(),now(),'FC-AGE-1'),
        ($3,'suspension-admin@example.test','fixture','Admin fictício','admin',now(),now(),'FC-AGE-1')`,[ids.user,ids.seller,ids.admin]);
      await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,quantity,kind,price_cents,status,published_at) VALUES
        ($1,$2,'Anúncio próprio ativo','Pacote fictício que deve ser pausado pela suspensão.','infant','Pampers','Confort Sec','sealed',1,'sale',10000,'published',now()),
        ($3,$4,'Anúncio de outro vendedor','Pacote fictício para tentativa de nova compra.','infant','Pampers','Confort Sec','sealed',1,'sale',12000,'published',now())`,[ids.ownListing,ids.user,ids.listing,ids.seller]);
      await database.query("INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents) VALUES($1,$2,$3,$4,'paid',12000)",[ids.transaction,ids.listing,ids.user,ids.seller]);
      await database.query(`INSERT INTO payment_intents(transaction_id,buyer_id,idempotency_key,method,amount_cents,platform_fee_cents,delivery_fee_cents,seller_amount_cents,provider_reference,status)
        VALUES($1,$2,'suspension-existing-payment','pix',12000,960,0,11040,'suspension-existing-reference','paid')`,[ids.transaction,ids.user]);
      const moderationRepository=createModerationRepository(database);
      const marketplaceService=createMarketplaceService(createMarketplaceRepository(database),moderationRepository,{async verifyListingMedia(){}});
      const actors={user:{id:ids.user,role:'customer',adultDeclared:true},admin:{id:ids.admin,role:'admin',adultDeclared:true}};
      api=createApiServer({
        config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),
        marketplaceService,
        moderationService:createModerationService(moderationRepository),
        communicationsService:createCommunicationsService(createCommunicationsRepository(database),moderationRepository),
        authService:{async session(token){return actors[token]??null;}},
      });
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({cookie:`fc_session=${token}`,'content-type':'application/json'});
      const suspension=await fetch(`${origin}/v1/moderation/suspensions`,{method:'POST',headers:headers('admin'),body:JSON.stringify({userId:ids.user,reason:'Suspensão temporária fictícia com acompanhamento preservado.',until:new Date(Date.now()+86400000).toISOString(),idempotencyKey:'suspension-http-postgres'})});
      assert.equal(suspension.status,200,await suspension.text());
      const listingPayload={title:'Novo pacote fictício',description:'Descrição suficiente para testar o bloqueio da publicação.',kind:'sale',quantity:1,priceCents:10000,category:'infant',brand:'Pampers',model:'Confort Sec',packageCondition:'sealed',mediaKeys:[`listings/${ids.user}/fixture.webp`]};
      const create=await fetch(`${origin}/v1/listings`,{method:'POST',headers:headers('user'),body:JSON.stringify(listingPayload)});
      assert.equal(create.status,403);assert.equal((await create.json()).error.code,'new_operations_suspended');
      const purchase=await fetch(`${origin}/v1/listings/${ids.listing}/transactions`,{method:'POST',headers:headers('user'),body:'{}'});
      assert.equal(purchase.status,403);assert.equal((await purchase.json()).error.code,'new_operations_suspended');
      const messages=await fetch(`${origin}/v1/transactions/${ids.transaction}/messages`,{headers:headers('user')});
      assert.equal(messages.status,200,await messages.text());
      const support=await fetch(`${origin}/v1/support/tickets`,{method:'POST',headers:headers('user'),body:JSON.stringify({category:'account',subject:'Acompanhar suspensão',details:'Solicito acompanhamento da suspensão temporária fictícia.',idempotencyKey:'suspension-support-http'})});
      assert.equal(support.status,201,await support.text());
      const tickets=await fetch(`${origin}/v1/support/tickets`,{headers:headers('user')});
      assert.equal(tickets.status,200);assert.equal((await tickets.json()).items.length,1);
      assert.equal((await database.query('SELECT status FROM listings WHERE id=$1',[ids.ownListing])).rows[0].status,'paused');
      assert.equal((await database.query('SELECT count(*)::integer AS n FROM transactions WHERE buyer_id=$1',[ids.user])).rows[0].n,1);
    }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
  });
});
