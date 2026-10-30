import assert from 'node:assert/strict';
import test from 'node:test';
import {createAccountConsentService} from '../apps/api/account-consent-service.js';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createNotificationService} from '../apps/api/notifications.js';
import {createAccountConsentRepository} from '../database/account-consent-repository.js';
import {createDatabase} from '../database/client.js';
import {newOperationsAllowed} from '../database/moderation-repository.js';
import {createNotificationRepository} from '../database/notification-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';
import {runNotificationBatch} from '../workers/notifications.js';

const native=await nativePostgresTools();
const userId='11111111-1111-4111-8111-111111111111';

test('optional operational notices respect HTTP preferences without blocking operations or contacting a provider',{skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{
  const database=createDatabase({databaseUrl,databaseSsl:false});let api;
  try{
   await migrate(database,await discoverMigrations());
   await database.query(`INSERT INTO users(id,email,phone,password_hash,display_name,email_verified_at,phone_verified_at)
    VALUES($1,'operational-notices@example.test','+5531999000000','fixture','Pessoa fictícia',now(),now())`,[userId]);
   const consentService=createAccountConsentService(createAccountConsentRepository(database)),notificationRepository=createNotificationRepository(database),notificationService=createNotificationService(notificationRepository);
   api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),accountConsentService:consentService,authService:{async session(token){return token==='owner'?{id:userId,role:'customer'}:null;}}});
   await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
   const url=`http://127.0.0.1:${api.address().port}/v1/account/operational-preferences`,headers={'content-type':'application/json',cookie:'fc_session=owner'};
   const initial=await fetch(url,{headers}),initialBody=await initial.json();assert.equal(initial.status,200,JSON.stringify(initialBody));assert.equal(initialBody.preferences.configured,false);assert.equal(initial.headers.get('cache-control'),'no-store');
   const enabled={expectedVersion:0,channels:{email:true,sms:false,push:false},quietHours:{enabled:true,start:'21:00',end:'08:00',timeZone:'UTC'}};
   const saved=await fetch(url,{method:'PUT',headers,body:JSON.stringify(enabled)}),savedBody=await saved.json();assert.equal(saved.status,200,JSON.stringify(savedBody));assert.equal(savedBody.reused,false);assert.equal(savedBody.preferences.version,1);
   const replay=await fetch(url,{method:'PUT',headers,body:JSON.stringify(enabled)}),replayBody=await replay.json();assert.equal(replay.status,200,JSON.stringify(replayBody));assert.equal(replayBody.reused,true);assert.equal(replayBody.preferences.version,1);
   const queued=await notificationService.reminder({kind:'delivery_reminder',userId,email:'operational-notices@example.test',channel:'email',payload:{message:'Lembrete operacional fictício'}});assert.equal(queued.queued,true);
   let providerCalls=0;
   await runNotificationBatch(notificationRepository,{},async()=>{providerCalls++;return{ok:true};},()=>new Date('2026-10-18T23:00:00Z'));
   const deferred=(await database.query(`SELECT status,attempts,available_at>created_at+interval '14 minutes' AS deferred FROM notification_outbox WHERE id=$1`,[queued.id])).rows[0];assert.deepEqual(deferred,{status:'pending',attempts:0,deferred:true});assert.equal(providerCalls,0);
   const disabled={expectedVersion:1,channels:{email:false,sms:false,push:false},quietHours:{enabled:false,start:null,end:null,timeZone:'UTC'}};
   const changed=await fetch(url,{method:'PUT',headers,body:JSON.stringify(disabled)}),changedBody=await changed.json();assert.equal(changed.status,200,JSON.stringify(changedBody));assert.equal(changedBody.preferences.version,2);
   await database.query('UPDATE notification_outbox SET available_at=now() WHERE id=$1',[queued.id]);
   await runNotificationBatch(notificationRepository,{},async()=>{providerCalls++;return{ok:true};},()=>new Date('2026-10-18T12:00:00Z'));
   const cancelled=(await database.query('SELECT status,last_error FROM notification_outbox WHERE id=$1',[queued.id])).rows[0];assert.equal(cancelled.status,'cancelled');assert.match(cancelled.last_error,/channel is not enabled/);assert.equal(providerCalls,0);
   assert.equal(await database.transaction(client=>newOperationsAllowed(client,userId)),true);
   assert.equal((await database.query('SELECT count(*)::int AS n FROM operational_preference_events WHERE user_id=$1',[userId])).rows[0].n,2);
   assert.equal((await database.query("SELECT count(*)::int AS n FROM audit_events WHERE actor_user_id=$1 AND action='account.operational_preferences.changed'",[userId])).rows[0].n,2);
  }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
 });
});
