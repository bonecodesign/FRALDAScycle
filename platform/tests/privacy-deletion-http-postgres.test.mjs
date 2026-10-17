import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createPrivacyRequestService} from '../apps/api/privacy-request-service.js';
import {createDatabase} from '../database/client.js';
import {createPrivacyRequestRepository} from '../database/privacy-request-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const ids={owner:'11111111-1111-4111-8111-111111111111',outsider:'22222222-2222-4222-8222-222222222222',admin:'33333333-3333-4333-8333-333333333333'};

test('deletion request is private, assessed independently and never erases an account over HTTP/PostgreSQL',{
  skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const database=createDatabase({databaseUrl,databaseSsl:false});let api;
    try{
      await migrate(database,await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
        ($1,'privacy-owner@example.test','fixture','Titular fictício','customer'),
        ($2,'privacy-outsider@example.test','fixture','Pessoa externa','customer'),
        ($3,'privacy-admin@example.test','fixture','Revisor fictício','admin')`,[ids.owner,ids.outsider,ids.admin]);
      const service=createPrivacyRequestService(createPrivacyRequestRepository(database));
      const actors={owner:{id:ids.owner,role:'customer'},outsider:{id:ids.outsider,role:'customer'},admin:{id:ids.admin,role:'admin'}};
      api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),privacyRequestService:service,authService:{async session(token){return actors[token]??null;}}});
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({'content-type':'application/json',cookie:`fc_session=${token}`});
      const payload={kind:'deletion',details:'Solicito análise da exclusão da minha conta fictícia.',confirmed:true,idempotencyKey:'privacy-deletion-http-postgres'};
      const created=await fetch(`${origin}/v1/privacy-requests`,{method:'POST',headers:headers('owner'),body:JSON.stringify(payload)});const first=await created.json();assert.equal(created.status,201,JSON.stringify(first));assert.equal(first.request.kind,'deletion');assert.equal(first.request.closureAllowed,false);assert.equal(first.request.erasureAllowed,false);const requestId=first.request.id;
      const replay=await fetch(`${origin}/v1/privacy-requests`,{method:'POST',headers:headers('owner'),body:JSON.stringify(payload)});assert.equal(replay.status,200);assert.equal((await replay.json()).request.reused,true);
      const forbidden=await fetch(`${origin}/v1/privacy-requests/${requestId}`,{headers:headers('outsider')});assert.equal(forbidden.status,404);
      const ownAssessment=await fetch(`${origin}/v1/privacy-requests/${requestId}/assessment`,{method:'POST',headers:headers('owner'),body:JSON.stringify({expectedVersion:0,reason:'Tentativa fictícia do próprio titular de analisar seu pedido.',confirmed:true})});assert.equal(ownAssessment.status,403);
      const assessed=await fetch(`${origin}/v1/privacy-requests/${requestId}/assessment`,{method:'POST',headers:headers('admin'),body:JSON.stringify({expectedVersion:0,reason:'Análise independente fictícia das pendências e retenções.',confirmed:true})});const assessment=await assessed.json();assert.equal(assessed.status,201,JSON.stringify(assessment));assert.equal(assessment.request.status,'under_review');assert.equal(assessment.request.version,1);assert.equal(assessment.request.closureAllowed,false);assert.equal(assessment.request.erasureAllowed,false);
      const detail=await fetch(`${origin}/v1/privacy-requests/${requestId}`,{headers:headers('owner')});const body=await detail.json();assert.equal(detail.status,200,JSON.stringify(body));assert.equal(body.request.status,'under_review');assert.equal(body.request.assessments.length,1);assert.equal(body.request.currentObligations.retentionPolicyStatus,'awaiting_review');assert.equal(body.request.erasureAllowed,false);
      assert.equal((await database.query('SELECT count(*)::integer AS n FROM users WHERE id=$1',[ids.owner])).rows[0].n,1);
      assert.equal((await database.query('SELECT count(*)::integer AS n FROM privacy_request_assessments WHERE request_id=$1',[requestId])).rows[0].n,1);
      assert.equal((await database.query("SELECT count(*)::integer AS n FROM audit_events WHERE action='privacy.request.assessed' AND entity_id=$1",[requestId])).rows[0].n,1);
    }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
  });
});
