import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createOperationalControlService} from '../apps/api/operational-control.js';
import {createOperationalIncidentService} from '../apps/api/operational-incident-service.js';
import {createDatabase} from '../database/client.js';
import {migrate,discoverMigrations} from '../database/migrate.js';
import {createOperationalControlRepository} from '../database/operational-control-repository.js';
import {createOperationalIncidentRepository} from '../database/operational-incident-repository.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const ids={admin:'11111111-1111-4111-8111-111111111111',moderator:'22222222-2222-4222-8222-222222222222'};
const key='33333333-3333-4333-8333-333333333333';

test('incident console and financial stops are private, persistent and audited over HTTP/PostgreSQL',{skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{
  const database=createDatabase({databaseUrl,databaseSsl:false});let api;
  try{
   await migrate(database,await discoverMigrations());
   await database.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
    ($1,'incident-admin@example.test','fixture','Admin fictício','admin'),
    ($2,'incident-moderator@example.test','fixture','Moderador fictício','moderator')`,Object.values(ids));
   const actors={admin:{id:ids.admin,role:'admin'},moderator:{id:ids.moderator,role:'moderator'}};
   api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),authService:{async session(token){return actors[token]??null;}},
    operationalControlService:createOperationalControlService(createOperationalControlRepository(database)),
    operationalIncidentService:createOperationalIncidentService(createOperationalIncidentRepository(database),{clock:()=>Date.parse('2026-10-29T12:00:00Z')})});
   await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
   const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({cookie:`fc_session=${token}`,'content-type':'application/json'}),root=`${origin}/v1/admin/incidents`;
   assert.equal((await fetch(root,{headers:headers('moderator')})).status,403);
   const input={idempotencyKey:key,title:'Suspeita sintética de cobrança duplicada',summary:'Ocorrência totalmente sintética usada para validar o console interno.',severity:'critical',domain:'payments'};
   const created=await fetch(root,{method:'POST',headers:headers('admin'),body:JSON.stringify(input)}),body=await created.json();assert.equal(created.status,201,JSON.stringify(body));assert.equal(body.reused,false);const incidentId=body.incident.id;assert.match(body.incident.reference,/^FC-INC-20261029-/);
   const replay=await fetch(root,{method:'POST',headers:headers('admin'),body:JSON.stringify(input)});assert.equal(replay.status,200);assert.equal((await replay.json()).reused,true);
   const claimed=await fetch(`${root}/${incidentId}`,{method:'PATCH',headers:headers('admin'),body:JSON.stringify({action:'claim',expectedVersion:1,note:'Responsabilidade técnica assumida para contenção.'})}),claimedBody=await claimed.json();assert.equal(claimed.status,200,JSON.stringify(claimedBody));assert.equal(claimedBody.incident.assigned_to,ids.admin);
   const stale=await fetch(`${root}/${incidentId}`,{method:'PATCH',headers:headers('admin'),body:JSON.stringify({action:'contain',expectedVersion:1,note:'Tentativa com versão antiga deve ser recusada.'})});assert.equal(stale.status,409);
   const contained=await fetch(`${root}/${incidentId}`,{method:'PATCH',headers:headers('admin'),body:JSON.stringify({action:'contain',expectedVersion:2,note:'Novas cobranças interrompidas preventivamente.'})});assert.equal(contained.status,200);assert.equal((await contained.json()).incident.status,'contained');
   const pauseRefunds=await fetch(`${origin}/v1/admin/operational-control`,{method:'PUT',headers:headers('admin'),body:JSON.stringify({domain:'refunds',action:'pause',reason:'Reembolsos pausados durante conciliação do incidente.',confirmed:true})});assert.equal(pauseRefunds.status,200);
   const blocked=await fetch(`${origin}/v1/payments/44444444-4444-4444-8444-444444444444/refunds`,{method:'POST',headers:headers('admin'),body:'{}'});assert.equal(blocked.status,503);assert.equal((await blocked.json()).error.code,'operational_paused');
   const dispute=await fetch(`${origin}/v1/payments/44444444-4444-4444-8444-444444444444/disputes`,{method:'POST',headers:headers('admin'),body:'{}'});assert.notEqual(dispute.status,503);
   const detail=await fetch(`${root}/${incidentId}`,{headers:headers('admin')}),detailBody=await detail.json();assert.equal(detail.status,200);assert.deepEqual(detailBody.events.map(event=>event.action),['created','claimed','contained']);
   const audits=(await database.query(`SELECT action FROM audit_events WHERE entity_id=$1 ORDER BY occurred_at,id`,[incidentId])).rows.map(row=>row.action);assert.deepEqual(audits,['incident.created','incident.claimed','incident.contained']);
  }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
 });
});
