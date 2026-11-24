import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createAdminService} from '../apps/api/admin-service.js';
import {createMarketplaceService} from '../apps/api/marketplace-service.js';
import {createAdminRepository} from '../database/admin-repository.js';
import {createMarketplaceRepository} from '../database/marketplace-repository.js';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const ids={
  seller:'a3090000-0000-4000-8000-000000000001',
  buyer:'a3090000-0000-4000-8000-000000000002',
  moderator:'a3090000-0000-4000-8000-000000000003',
  outsider:'a3090000-0000-4000-8000-000000000004',
  key:'a3090000-0000-4000-8000-000000000005',
};
const mediaKey='listings/'+ids.seller+'/fc309-synthetic.webp';

test('FC-309 joins authenticated HTTP creation, independent review, search, reservation and unpaid chat on real temporary PostgreSQL',{
  skip:!native&&!process.env.CI?'PostgreSQL nativo não disponível; teste nunca simulado.':false,
  timeout:60000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const database=createDatabase({databaseUrl,databaseSsl:false});
    let api;
    try{
      await migrate(database,await discoverMigrations());
      await database.query(
        "INSERT INTO users(id,email,password_hash,display_name,role,staff_access_level,staff_sector) VALUES "+
        "($1,'fc309-seller@example.test','synthetic-inactive','Vendedor fictício','customer',NULL,NULL),"+
        "($2,'fc309-buyer@example.test','synthetic-inactive','Comprador fictício','customer',NULL,NULL),"+
        "($3,'fc309-moderator@example.test','synthetic-inactive','Revisor fictício','moderator',2,'moderation'),"+
        "($4,'fc309-outsider@example.test','synthetic-inactive','Visitante fictício','customer',NULL,NULL)",
        [ids.seller,ids.buyer,ids.moderator,ids.outsider],
      );
      const actors={
        seller:{id:ids.seller,role:'customer',adultDeclared:true,sessionId:'fc309-seller'},
        buyer:{id:ids.buyer,role:'customer',adultDeclared:true,sessionId:'fc309-buyer'},
        moderator:{id:ids.moderator,role:'moderator',staffSector:'moderation',staffAccessLevel:2,sessionId:'fc309-reviewer'},
        outsider:{id:ids.outsider,role:'customer',adultDeclared:true,sessionId:'fc309-outsider'},
      };
      let mediaReady=true;
      const calls=[];
      const mediaProvider={
        async verifyListingMedia(ownerId,keys){
          calls.push({action:'verify',ownerId,keys});
          assert.equal(ownerId,ids.seller);
          assert.deepEqual(keys,[mediaKey]);
          if(!mediaReady)throw Object.assign(new Error('Foto fictícia ainda indisponível'),{code:'media_not_ready',status:409});
          return {verified:true,count:1};
        },
        async signedProofRead(reviewerId,key){
          calls.push({action:'signedProofRead',reviewerId,key});
          assert.equal(reviewerId,ids.moderator);
          assert.equal(key,mediaKey);
          return {readUrl:'https://media.example.test/opaque-synthetic-review',expiresAt:new Date(Date.now()+120000).toISOString()};
        },
      };
      api=createApiServer({
        config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),
        authService:{async session(token){return actors[token]??null;}},
        marketplaceService:createMarketplaceService(createMarketplaceRepository(database),null,mediaProvider),
        adminService:createAdminService(createAdminRepository(database),mediaProvider,{
          reviewSecret:'fc309-synthetic-review-not-for-production'.repeat(2),
        }),
        marketplaceProviders:mediaProvider,
      });
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      const origin='http://127.0.0.1:'+api.address().port;
      const headers=token=>({'content-type':'application/json',...(token?{cookie:'fc_session='+token}:{})});
      const get=(path,token)=>fetch(origin+path,{headers:headers(token)});
      const post=(path,token,payload)=>fetch(origin+path,{method:'POST',headers:headers(token),body:JSON.stringify(payload)});
      const listingPayload={
        title:'Pacote Pampers Confort Sec fictício',
        description:'Pacote lacrado, fictício, guardado em ambiente seco.',
        category:'infant',brand:'Pampers',model:'Confort Sec',
        size:'M',quantity:28,stockUnits:1,kind:'sale',
        priceCents:3790,packageCondition:'sealed',
        city:'Belo Horizonte',state:'MG',
        idempotencyKey:ids.key,mediaKeys:[mediaKey],
      };

      const unauthenticatedCreate=await post('/v1/listings',null,listingPayload);
      assert.equal(unauthenticatedCreate.status,401);
      assert.equal((await unauthenticatedCreate.json()).error.code,'unauthenticated');

      const foreignMedia=await post('/v1/listings','seller',{
        ...listingPayload,mediaKeys:['listings/'+ids.buyer+'/foreign.webp'],
      });
      assert.equal(foreignMedia.status,422);
      assert.equal((await foreignMedia.json()).error.code,'invalid_media');

      const created=await post('/v1/listings','seller',listingPayload);
      const createdBody=await created.json();
      assert.equal(created.status,201,JSON.stringify(createdBody));
      assert.equal(createdBody.listing.status,'review');
      const id=createdBody.listing.id;
      assert.match(id,/^[0-9a-f-]{36}$/i);

      const again=await post('/v1/listings','seller',listingPayload);
      const againBody=await again.json();
      assert.equal(again.status,200,JSON.stringify(againBody));
      assert.equal(againBody.listing.id,id);
      assert.equal((await database.query('SELECT count(*)::int AS n FROM listings WHERE id=$1',[id])).rows[0].n,1);

      const conflicted=await post('/v1/listings','seller',{...listingPayload,priceCents:4200});
      assert.equal(conflicted.status,409);
      assert.equal((await conflicted.json()).error.code,'listing_creation_conflict');

      const reviewPath='/v1/admin/listings/'+id+'/review';
      const publicPath='/v1/listings/'+id;
      const searchPath='/v1/listings?query=Pampers&kind=sale&category=infant&size=M';
      const hidden=await get(searchPath);
      assert.equal(hidden.status,200);
      assert.equal((await hidden.json()).items.some(item=>item.id===id),false);
      const hiddenDetail=await get(publicPath);
      assert.equal(hiddenDetail.status,404);
      const hiddenDeal=await post(publicPath+'/transactions','buyer',{itemUnits:1});
      assert.equal(hiddenDeal.status,409);

      for(const token of [null,'seller','buyer','outsider']){
        const response=await get(reviewPath,token);
        assert.equal(response.status,token===null?401:403,token??'without login');
      }
      // FC-359: preview itself (not only final approval) must verify every
      // synthetic photo before disclosing any signed read URL to a moderator.
      mediaReady=false;
      const readsBeforeBlocked=calls.filter(item=>item.action==='signedProofRead').length;
      const blockedPreview=await get(reviewPath,'moderator');
      assert.equal(blockedPreview.status,409);
      assert.equal((await blockedPreview.json()).error.code,'media_not_ready');
      assert.equal(calls.filter(item=>item.action==='signedProofRead').length,readsBeforeBlocked,
        'unprocessed media must not receive review URLs');
      mediaReady=true;
      const callIndex=calls.length;
      const opened=await get(reviewPath,'moderator');
      const openedBody=await opened.json();
      assert.deepEqual(calls.slice(callIndex).map(item=>item.action),['verify','signedProofRead'],
        'review preview must re-verify media BEFORE signing');
      assert.equal(opened.status,200,JSON.stringify(openedBody));
      assert.equal(opened.headers.get('cache-control'),'no-store');
      assert.equal(openedBody.listing.status,'review');
      assert.equal(openedBody.media.length,1);
      assert.ok(openedBody.reviewContext);
      assert.equal(JSON.stringify(openedBody).includes('storage_key'),false);
      const approval={outcome:'published',reason:'Conferência sintética de foto e estado do produto.',confirmed:true,reviewContext:openedBody.reviewContext};

      const unauthorizedApproval=await post(reviewPath,'seller',approval);
      assert.equal(unauthorizedApproval.status,403);
      const noContext=await post(reviewPath,'moderator',{...approval,reviewContext:null});
      assert.equal(noContext.status,409);
      assert.equal((await noContext.json()).error.code,'listing_review_context_expired');

      mediaReady=false;
      const blockedApproval=await post(reviewPath,'moderator',approval);
      assert.equal(blockedApproval.status,409);
      assert.equal((await blockedApproval.json()).error.code,'media_not_ready');
      assert.equal((await database.query('SELECT status FROM listings WHERE id=$1',[id])).rows[0].status,'review');
      assert.equal((await database.query('SELECT count(*)::int AS n FROM listing_review_decisions WHERE listing_id=$1',[id])).rows[0].n,0);

      mediaReady=true;
      const approved=await post(reviewPath,'moderator',approval);
      const approvedBody=await approved.json();
      assert.equal(approved.status,200,JSON.stringify(approvedBody));
      assert.equal(approvedBody.listing.status,'published');
      assert.equal((await database.query('SELECT count(*)::int AS n FROM listing_review_decisions WHERE listing_id=$1',[id])).rows[0].n,1);
      assert.equal((await database.query("SELECT count(*)::int AS n FROM audit_events WHERE entity_id=$1 AND action='listing.review.approved'",[id])).rows[0].n,1);

      const search=await get(searchPath);
      const searchBody=await search.json();
      assert.equal(search.status,200,JSON.stringify(searchBody));
      assert.equal(searchBody.items.some(item=>item.id===id),true);
      const detail=await get(publicPath);
      const detailBody=await detail.json();
      assert.equal(detail.status,200,JSON.stringify(detailBody));
      assert.equal(detailBody.listing.price_cents,3790);

      const staleApproval=await post(reviewPath,'moderator',approval);
      assert.equal(staleApproval.status,409);
      assert.equal((await staleApproval.json()).error.code,'listing_review_conflict');

      const unauthenticatedPurchase=await post(publicPath+'/transactions',null,{itemUnits:1});
      assert.equal(unauthenticatedPurchase.status,401);
      const buyerPurchase=await post(publicPath+'/transactions','buyer',{itemUnits:1});
      const purchaseBody=await buyerPurchase.json();
      assert.equal(buyerPurchase.status,201,JSON.stringify(purchaseBody));
      assert.equal(purchaseBody.transaction.amount_cents,3790);
      assert.equal(purchaseBody.transaction.status,'initiated');
      const transactionId=purchaseBody.transaction.id;
      for(const token of ['buyer','seller']){
        const access=await get('/v1/transactions/'+transactionId+'/chat-access',token);
        const body=await access.json();
        assert.equal(access.status,200,JSON.stringify(body));
        assert.equal(body.allowed,false);
        assert.equal(body.reason,'payment_not_confirmed');
      }
      const otherAccess=await get('/v1/transactions/'+transactionId+'/chat-access','outsider');
      assert.equal(otherAccess.status,404);
      assert.equal((await otherAccess.json()).error.code,'transaction_not_found');
      const anonymousAccess=await get('/v1/transactions/'+transactionId+'/chat-access');
      assert.equal(anonymousAccess.status,401);
      assert.equal((await database.query('SELECT count(*)::int AS n FROM payment_intents WHERE transaction_id=$1',[transactionId])).rows[0].n,0);
      const unavailable=await get(searchPath);
      assert.equal((await unavailable.json()).items.some(item=>item.id===id),false);
      const duplicatePurchase=await post(publicPath+'/transactions','buyer',{itemUnits:1});
      assert.equal(duplicatePurchase.status,409);
      assert.equal((await database.query('SELECT count(*)::int AS n FROM transactions WHERE listing_id=$1',[id])).rows[0].n,1);
      // FC-359 adds two required preview checks: one denied GET before any
      // signed URL, then one verified GET before the existing approval checks.
      assert.equal(calls.filter(item=>item.action==='verify').length,5);
      console.log('FC-309 passed: authenticated HTTP create -> independent review -> catalog -> reserve -> unpaid chat blocked; media provider simulated.');
    }finally{
      if(api?.listening)await new Promise(resolve=>api.close(resolve));
      await database.close();
    }
  });
});
