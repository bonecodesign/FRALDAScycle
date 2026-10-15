import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createCommunicationsService} from '../apps/api/communications-service.js';
import {createModerationService} from '../apps/api/moderation-service.js';
import {createReviewModerationService} from '../apps/api/review-moderation-service.js';
import {createCommunicationsRepository} from '../database/communications-repository.js';
import {createDatabase} from '../database/client.js';
import {createModerationRepository} from '../database/moderation-repository.js';
import {createReviewModerationRepository} from '../database/review-moderation-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const ids={seller:'11111111-1111-4111-8111-111111111111',buyer:'22222222-2222-4222-8222-222222222222',outsider:'33333333-3333-4333-8333-333333333333',moderator:'44444444-4444-4444-8444-444444444444',listing:'55555555-5555-4555-8555-555555555555',transaction:'66666666-6666-4666-8666-666666666666'};

test('reviews require completed participation and leave public consultation when reported over HTTP/PostgreSQL',{
  skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const database=createDatabase({databaseUrl,databaseSsl:false});let api;
    try{
      await migrate(database,await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
        ($1,'review-seller@example.test','fixture','Vendedor fictício','customer'),
        ($2,'review-buyer@example.test','fixture','Comprador fictício','customer'),
        ($3,'review-outsider@example.test','fixture','Denunciante fictício','customer'),
        ($4,'review-moderator@example.test','fixture','Moderador fictício','moderator')`,[ids.seller,ids.buyer,ids.outsider,ids.moderator]);
      await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,quantity,kind,price_cents,status)
        VALUES($1,$2,'Venda fictícia avaliada','Pacote fictício para validação de avaliações.','infant','Pampers','Confort Sec','sealed',1,'sale',10000,'unavailable')`,[ids.listing,ids.seller]);
      await database.query("INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents) VALUES($1,$2,$3,$4,'paid',10000)",[ids.transaction,ids.listing,ids.buyer,ids.seller]);
      const moderationRepository=createModerationRepository(database);
      const communicationsService=createCommunicationsService(createCommunicationsRepository(database),moderationRepository);
      const actors={seller:{id:ids.seller,role:'customer'},buyer:{id:ids.buyer,role:'customer'},outsider:{id:ids.outsider,role:'customer'},moderator:{id:ids.moderator,role:'moderator'}};
      api=createApiServer({
        config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),
        communicationsService,
        moderationService:createModerationService(moderationRepository),
        reviewModerationService:createReviewModerationService(createReviewModerationRepository(database),moderationRepository),
        authService:{async session(token){return actors[token]??null;}},
      });
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({cookie:`fc_session=${token}`,'content-type':'application/json'}),reviewUrl=`${origin}/v1/transactions/${ids.transaction}/reviews`;
      const early=await fetch(reviewUrl,{method:'POST',headers:headers('buyer'),body:JSON.stringify({rating:5,comment:'Produto entregue conforme o anúncio.'})});
      assert.equal(early.status,409);assert.equal((await early.json()).error.code,'review_not_finalized');
      await database.query("UPDATE transactions SET status='completed' WHERE id=$1",[ids.transaction]);
      const outsider=await fetch(reviewUrl,{method:'POST',headers:headers('outsider'),body:JSON.stringify({rating:5,comment:'Tentativa externa de avaliação fictícia.'})});
      assert.equal(outsider.status,404);
      const blocked=await fetch(reviewUrl,{method:'POST',headers:headers('seller'),body:JSON.stringify({rating:4,comment:'Fale comigo em fake@example.test'})});
      assert.equal(blocked.status,422);assert.equal((await blocked.json()).error.code,'content_requires_moderation');
      const input={rating:5,comment:'Produto entregue conforme o anúncio.'};
      const created=await fetch(reviewUrl,{method:'POST',headers:headers('buyer'),body:JSON.stringify(input)}),createdBody=await created.json();
      assert.equal(created.status,200,JSON.stringify(createdBody));assert.equal(createdBody.reused,false);const reviewId=createdBody.review.id;
      const repeated=await fetch(reviewUrl,{method:'POST',headers:headers('buyer'),body:JSON.stringify(input)});
      assert.equal(repeated.status,200);assert.equal((await repeated.json()).reused,true);
      const publicBefore=await (await fetch(`${origin}/v1/users/${ids.seller}/reviews`)).json();
      assert.equal(publicBefore.items.length,1);assert.deepEqual(Object.keys(publicBefore.items[0]).sort(),['comment','created_at','id','rating']);
      const report=await fetch(`${origin}/v1/reviews/${reviewId}/report`,{method:'POST',headers:headers('outsider'),body:JSON.stringify({category:'offensive',details:'Conteúdo fictício encaminhado para análise independente.',confirmed:true})});
      assert.equal(report.status,201,await report.text());
      const publicDuring=await (await fetch(`${origin}/v1/users/${ids.seller}/reviews`)).json();assert.equal(publicDuring.items.length,0);
      const queue=await (await fetch(`${origin}/v1/admin/review-moderation`,{headers:headers('moderator')})).json();assert.equal(queue.items.length,1);
      const decision=await fetch(`${origin}/v1/admin/review-moderation/${reviewId}/decision`,{method:'POST',headers:headers('moderator'),body:JSON.stringify({outcome:'removed',reason:'Remoção fictícia após análise registrada.',expectedVersion:1,confirmed:true})});
      assert.equal(decision.status,201,await decision.text());
      assert.equal((await database.query('SELECT visibility FROM transaction_reviews WHERE id=$1',[reviewId])).rows[0].visibility,'removed');
      assert.equal((await database.query("SELECT count(*)::integer AS n FROM audit_events WHERE entity_id=$1 AND action IN ('review.created','review.reported','review.visibility.decided')",[reviewId])).rows[0].n,2);
    }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
  });
});
