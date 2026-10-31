import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {createAccountClosureService} from '../apps/api/account-closure-service.js';
import {createAccountStepUpService} from '../apps/api/account-step-up-service.js';
import {loadConfig} from '../apps/api/config.js';
import {hashPassword} from '../apps/api/security.js';
import {createAccountClosureRepository} from '../database/account-closure-repository.js';
import {createAccountStepUpRepository} from '../database/account-step-up-repository.js';
import {createDatabase} from '../database/client.js';
import {newOperationsAllowed} from '../database/moderation-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const ids={owner:'11111111-1111-4111-8111-111111111111',outsider:'22222222-2222-4222-8222-222222222222'};

test('account closure uses purpose-bound step-up, blocks operations for seven days and can be cancelled',{skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{
  const database=createDatabase({databaseUrl,databaseSsl:false});let api;
  try{
   await migrate(database,await discoverMigrations());const password='frase senha ficticia 2030',passwordHash=await hashPassword(password);
   await database.query(`INSERT INTO users(id,email,password_hash,display_name,role,email_verified_at) VALUES
    ($1,'closure-owner@example.test',$3,'Titular fictício','customer',now()),
    ($2,'closure-outsider@example.test',$3,'Pessoa externa','customer',now())`,[ids.owner,ids.outsider,passwordHash]);
   await database.query(`INSERT INTO premium_subscriptions(user_id,paid_period_start,paid_period_end,renewal_enabled)
     VALUES($1,now()-interval '1 day',now()+interval '29 days',true)`,[ids.owner]);
   const stepUpRepository=createAccountStepUpRepository(database),stepUpService=createAccountStepUpService(stepUpRepository),closureService=createAccountClosureService(createAccountClosureRepository(database,{stepUpRepository}));
   const actors={owner:{id:ids.owner,role:'customer'},outsider:{id:ids.outsider,role:'customer'}};
   api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),accountStepUpService:stepUpService,accountClosureService:closureService,authService:{async session(token){return actors[token]??null;}}});
   await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
   const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({cookie:`fc_session=${token}`,'content-type':'application/json'});
   const step=await fetch(`${origin}/v1/account/step-up/request`,{method:'POST',headers:headers('owner'),body:JSON.stringify({password,purpose:'account_closure'})}),stepBody=await step.json();assert.equal(step.status,202,JSON.stringify(stepBody));
   const code=(await database.query("SELECT payload->>'token' AS code FROM notification_outbox WHERE kind='account_step_up' AND recipient='closure-owner@example.test' ORDER BY id DESC LIMIT 1")).rows[0].code;
   const confirmed=await fetch(`${origin}/v1/account/step-up/confirm`,{method:'POST',headers:headers('owner'),body:JSON.stringify({challenge:stepBody.challenge,code,purpose:'account_closure'})}),confirmedBody=await confirmed.json();assert.equal(confirmed.status,200,JSON.stringify(confirmedBody));assert.ok(confirmedBody.grantId);
   const requestPayload={confirmed:true,noticeVersion:'FC-ACCOUNT-CLOSURE-1',idempotencyKey:'account-closure-http-postgres',stepUpGrantId:confirmedBody.grantId};
   const requested=await fetch(`${origin}/v1/account/closure/request`,{method:'POST',headers:headers('owner'),body:JSON.stringify(requestPayload)}),requestedBody=await requested.json();assert.equal(requested.status,201,JSON.stringify(requestedBody));assert.equal(requestedBody.request.status,'cooling_off');assert.equal(requestedBody.automaticErasureAllowed,false);
   const stored=(await database.query(`SELECT id,status,version,extract(epoch FROM(cancel_until-requested_at))::int AS window_seconds FROM account_closure_requests WHERE id=$1`,[requestedBody.request.id])).rows[0];assert.deepEqual(stored,{id:requestedBody.request.id,status:'cooling_off',version:0,window_seconds:7*24*60*60});
   const premium=(await database.query('SELECT renewal_enabled,renewal_cancelled_at IS NOT NULL AS renewal_cancelled FROM premium_subscriptions WHERE user_id=$1',[ids.owner])).rows[0];assert.deepEqual(premium,{renewal_enabled:false,renewal_cancelled:true});
   assert.equal(await database.transaction(client=>newOperationsAllowed(client,ids.owner)),false);
   assert.equal((await database.query("SELECT count(*)::int AS n FROM account_operation_restrictions WHERE user_id=$1 AND reason='closure_pending'",[ids.owner])).rows[0].n,1);
   const outsiderCancel=await fetch(`${origin}/v1/account/closure/${requestedBody.request.id}/cancel`,{method:'POST',headers:headers('outsider'),body:JSON.stringify({confirmed:true,expectedVersion:0})});assert.equal(outsiderCancel.status,404);
   const cancelled=await fetch(`${origin}/v1/account/closure/${requestedBody.request.id}/cancel`,{method:'POST',headers:headers('owner'),body:JSON.stringify({confirmed:true,expectedVersion:0})}),cancelledBody=await cancelled.json();assert.equal(cancelled.status,200,JSON.stringify(cancelledBody));assert.equal(cancelledBody.request.status,'cancelled');assert.equal(cancelledBody.request.version,1);assert.equal(cancelledBody.automaticErasureAllowed,false);
   assert.equal(await database.transaction(client=>newOperationsAllowed(client,ids.owner)),true);
   assert.equal((await database.query('SELECT count(*)::int AS n FROM account_operation_restrictions WHERE user_id=$1',[ids.owner])).rows[0].n,0);
   assert.equal((await database.query('SELECT count(*)::int AS n FROM users WHERE id=$1',[ids.owner])).rows[0].n,1);
   const audit=(await database.query("SELECT action,count(*)::int AS n FROM audit_events WHERE entity_id=$1 AND action IN ('account.closure.requested','account.closure.cancelled') GROUP BY action ORDER BY action",[requestedBody.request.id])).rows;assert.deepEqual(audit,[{action:'account.closure.cancelled',n:1},{action:'account.closure.requested',n:1}]);
  }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
 });
});
