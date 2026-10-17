import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createModerationService} from '../apps/api/moderation-service.js';
import {createDatabase} from '../database/client.js';
import {createModerationRepository,newOperationsAllowed} from '../database/moderation-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const ids={owner:'11111111-1111-4111-8111-111111111111',initialReviewer:'22222222-2222-4222-8222-222222222222',independentReviewer:'33333333-3333-4333-8333-333333333333'};

test('temporary suspension appeal requires an independent reviewer and can restore new operations over HTTP/PostgreSQL',{
  skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const database=createDatabase({databaseUrl,databaseSsl:false});let api;
    try{
      await migrate(database,await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
        ($1,'appeal-owner@example.test','fixture','Titular fictício','customer'),
        ($2,'appeal-first@example.test','fixture','Primeiro revisor','admin'),
        ($3,'appeal-second@example.test','fixture','Revisor independente','admin')`,[ids.owner,ids.initialReviewer,ids.independentReviewer]);
      const repository=createModerationRepository(database),service=createModerationService(repository);
      const actors={owner:{id:ids.owner,role:'customer'},first:{id:ids.initialReviewer,role:'admin'},second:{id:ids.independentReviewer,role:'admin'}};
      api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),moderationService:service,authService:{async session(token){return actors[token]??null;}}});
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({'content-type':'application/json',cookie:`fc_session=${token}`});
      const suspended=await fetch(`${origin}/v1/moderation/suspensions`,{method:'POST',headers:headers('first'),body:JSON.stringify({userId:ids.owner,reason:'Suspensão temporária fictícia sujeita a recurso independente.',until:new Date(Date.now()+86400000).toISOString(),idempotencyKey:'moderation-appeal-http-postgres'})});
      const suspension=await suspended.json();assert.equal(suspended.status,200,JSON.stringify(suspension));const decisionId=suspension.decision.id;
      assert.equal(await database.transaction(client=>newOperationsAllowed(client,ids.owner)),false);
      const appeal=await fetch(`${origin}/v1/moderation/decisions/${decisionId}/appeal`,{method:'POST',headers:headers('owner'),body:JSON.stringify({body:'Peço revisão desta suspensão temporária fictícia e apresento meu contexto.'})});
      const appealBody=await appeal.json();assert.equal(appeal.status,200,JSON.stringify(appealBody));assert.ok(appealBody.appeal.id);assert.ok(appealBody.protocol);
      const sameReviewer=await fetch(`${origin}/v1/moderation/decisions/${decisionId}/review`,{method:'POST',headers:headers('first'),body:JSON.stringify({outcome:'overturned',reason:'A pessoa que decidiu não pode revisar o próprio recurso.',confirmed:true,reviewedText:null})});assert.equal(sameReviewer.status,403);
      const reviewed=await fetch(`${origin}/v1/moderation/decisions/${decisionId}/review`,{method:'POST',headers:headers('second'),body:JSON.stringify({outcome:'overturned',reason:'Revisão independente identificou suspensão fictícia improcedente.',confirmed:true,reviewedText:null})});
      const reviewBody=await reviewed.json();assert.equal(reviewed.status,200,JSON.stringify(reviewBody));assert.equal(reviewBody.status,'overturned');assert.equal(reviewBody.reused,false);
      const detail=await fetch(`${origin}/v1/moderation/decisions/${decisionId}`,{headers:headers('owner')});const detailBody=await detail.json();assert.equal(detail.status,200,JSON.stringify(detailBody));assert.equal(detailBody.decision.status,'overturned');assert.equal(detailBody.decision.outcome,'overturned');
      assert.equal(await database.transaction(client=>newOperationsAllowed(client,ids.owner)),true);
      const stored=(await database.query('SELECT d.status,a.outcome,st.status AS ticket_status FROM moderation_decisions d JOIN moderation_appeals a ON a.decision_id=d.id JOIN support_tickets st ON st.id=a.ticket_id WHERE d.id=$1',[decisionId])).rows[0];
      assert.deepEqual(stored,{status:'overturned',outcome:'overturned',ticket_status:'resolved'});
      assert.equal((await database.query("SELECT count(*)::integer AS n FROM audit_events WHERE action='moderation.appeal.reviewed' AND entity_id=$1",[decisionId])).rows[0].n,1);
    }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
  });
});
