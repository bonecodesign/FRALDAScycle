import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {hashPassword} from '../apps/api/security.js';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {createAccountStepUpRepository} from '../database/account-step-up-repository.js';
import {createAccountStepUpService} from '../apps/api/account-step-up-service.js';
import {createSupportDutyRepository} from '../database/support-duty-repository.js';
import {createSupportDutyService} from '../apps/api/support-duty-service.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';
const native=await nativePostgresTools();
const ids={
 proposer:'11111111-1111-4111-8111-111111111111',
 reviewer:'22222222-2222-4222-8222-222222222222',
 founder:'33333333-3333-4333-8333-333333333333',
 nominee:'44444444-4444-4444-8444-444444444444',
 unrelated:'55555555-5555-4555-8555-555555555555',
};
const password='FraldaCycle synthetic secure password 2026';
test('support duty stage chain: L3 → independent L4 → founder L5 → nominee and founder revocation', {
 skip:!native&&!process.env.CI?'PostgreSQL nativo indisponível.':false,timeout:90000,
},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{
  const db=createDatabase({databaseUrl,databaseSsl:false});let api;
  try{
   await migrate(db,await discoverMigrations());
   const hash=await hashPassword(password);
   await db.query(`INSERT INTO users(id,email,password_hash,display_name,role,staff_access_level,staff_sector,email_verified_at)
     VALUES
     ($1,'fc324-proposer@example.test',$6,'Proponente sintético','admin',3,'support',now()),
     ($2,'fc324-reviewer@example.test',$6,'Revisor sintético','admin',4,'operations',now()),
     ($3,'fc324-founder@example.test',$6,'Fundador sintético','admin',5,'founder',now()),
     ($4,'fc324-nominee@example.test',$6,'Nomeado sintético','moderator',1,'support',now()),
     ($5,'fc324-unrelated@example.test',$6,'Pessoa externa sintética','admin',4,'finance',now())`,
     [...Object.values(ids),hash]);
   const actors={
    proposer:{id:ids.proposer,role:'admin',staffAccessLevel:3,staffSector:'support'},
    reviewer:{id:ids.reviewer,role:'admin',staffAccessLevel:4,staffSector:'operations'},
    founder:{id:ids.founder,role:'admin',staffAccessLevel:5,staffSector:'founder'},
    nominee:{id:ids.nominee,role:'moderator',staffAccessLevel:1,staffSector:'support'},
    unrelated:{id:ids.unrelated,role:'admin',staffAccessLevel:4,staffSector:'finance'},
    customer:{id:ids.unrelated,role:'customer'},
   };
   const step= createAccountStepUpRepository(db);
   const repo=createSupportDutyRepository(db,{stepUpRepository:step});
   api=createApiServer({
    config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),
    authService:{async session(t){return actors[t]??null;}},
    supportDutyService:createSupportDutyService(repo),
    accountStepUpService:createAccountStepUpService(step),
   });
   await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
   const base='http://127.0.0.1:'+api.address().port;
   const send=async(token,method,path,body)=>{
    const response=await fetch(base+path,{method,headers:{
      cookie:'fc_session='+token,'content-type':'application/json',
    },...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,headers:response.headers,body:await response.json()};
   };
   const grant=async(token)=>{
    const r=await send(token,'POST','/v1/account/step-up/request',{password,purpose:'support_duty_assignment'});
    assert.equal(r.status,202,JSON.stringify(r.body));
    const code=(await db.query(`SELECT o.payload->>'token' AS code FROM notification_outbox o
      JOIN auth_tokens t ON t.id=o.auth_token_id WHERE o.kind='account_step_up'
      AND o.recipient=$1 AND t.consumed_at IS NULL AND t.expires_at>now()
      ORDER BY o.created_at DESC LIMIT 1`,['fc324-'+token+'@example.test'])).rows[0].code;
    const verified=await send(token,'POST','/v1/account/step-up/confirm',
     {challenge:r.body.challenge,code,purpose:'support_duty_assignment'});
    assert.equal(verified.status,200,JSON.stringify(verified.body));
    return verified.body.grantId;
   };
   const list='/v1/admin/support-duty',proposals=list+'/proposals',reason='Registro sintético para confirmar a governança do piloto.';
   assert.equal((await send('customer','GET',list)).status,403);
   assert.equal((await send('unrelated','GET',list)).status,403);
   const grant3=await grant('proposer');
   assert.equal((await send('reviewer','POST',proposals,
      {targetUserId:ids.nominee,roleKind:'primary',reason,grantId:grant3})).status,403);
   const nominated=await send('proposer','POST',proposals,
    {targetUserId:ids.nominee,roleKind:'primary',reason,grantId:grant3});
   assert.equal(nominated.status,201,JSON.stringify(nominated.body));
   const proposalId=nominated.body.proposal.id;
   assert.equal(nominated.body.proposal.status,'pending_review');
   const reusedGrant=await send('proposer','POST',proposals,
    {targetUserId:ids.nominee,roleKind:'substitute',reason,grantId:grant3});
   assert.equal(reusedGrant.status,409);
   assert.equal((await send('founder','POST',proposals+'/'+proposalId+'/decision',
    {approved:true,reason,grantId:grant3})).status,409);
   const grant4=await grant('reviewer');
   assert.equal((await send('reviewer','POST',proposals+'/'+proposalId+'/review',
    {approved:true,reason,grantId:grant3})).status,409);
   const reviewed=await send('reviewer','POST',proposals+'/'+proposalId+'/review',
    {approved:true,reason,grantId:grant4});
   assert.equal(reviewed.status,200,JSON.stringify(reviewed.body));
   assert.equal(reviewed.body.proposal.status,'pending_founder');
   const grant5=await grant('founder');
   const decided=await send('founder','POST',proposals+'/'+proposalId+'/decision',
    {approved:true,reason,grantId:grant5});
   assert.equal(decided.status,200,JSON.stringify(decided.body));
   assert.equal(decided.body.proposal.status,'approved');
   assert.equal(decided.body.assignment.status,'pending');
   const assignmentId=decided.body.assignment.id;
   assert.equal((await send('reviewer','POST',list+'/assignments/'+assignmentId+'/response',
      {accepted:true,grantId:grant4})).status,403);
   const grantNominee=await grant('nominee');
   const acceptance=await send('nominee','POST',list+'/assignments/'+assignmentId+'/response',
    {accepted:true,grantId:grantNominee});
   assert.equal(acceptance.status,200,JSON.stringify(acceptance.body));
   assert.equal(acceptance.body.assignment.status,'accepted');
   assert.equal((await send('nominee','POST',list+'/assignments/'+assignmentId+'/response',
    {accepted:true,grantId:grantNominee})).status,404);
   const readable=await send('nominee','GET',list);
   assert.equal(readable.status,200);
   assert.equal(readable.body.assignments.length,1);
   assert.equal(readable.body.assignments[0].canRespond,false);
   assert.equal(readable.body.realStaffingActive,false);
   assert.equal(readable.body.externalDispatchAuthorized,false);
   const dutyBefore=await db.query("SELECT count(*)::int AS n FROM support_duty_assignments WHERE status='accepted'");
   assert.equal(dutyBefore.rows[0].n,1);
   // Two step-up challenges for the founder are separated by the documented cooldown.
   await db.query("UPDATE account_step_up_requests SET created_at=now()-interval '2 minutes' WHERE user_id=$1",[ids.founder]);
   const revokeGrant=await grant('founder');
   assert.equal((await send('reviewer','POST',list+'/assignments/'+assignmentId+'/revoke',
     {reason,grantId:grant4})).status,403);
   const revoked=await send('founder','POST',list+'/assignments/'+assignmentId+'/revoke',
    {reason,grantId:revokeGrant});
   assert.equal(revoked.status,200,JSON.stringify(revoked.body));
   assert.equal(revoked.body.assignment.status,'revoked');
   assert.equal((await send('founder','POST',list+'/assignments/'+assignmentId+'/revoke',
    {reason,grantId:revokeGrant})).status,409);
   assert.equal((await db.query("SELECT count(*)::int AS n FROM support_duty_assignments WHERE status='accepted'")).rows[0].n,0);
   const audit=(await db.query(`SELECT action FROM audit_events WHERE entity_type='support_duty'
      ORDER BY occurred_at,id`)).rows.map(x=>x.action);
   assert.deepEqual(audit,['support.duty.proposed','support.duty.review_approved',
    'support.duty.founder_approved','support.duty.accepted','support.duty.revoked']);
   const steps=(await db.query(`SELECT count(*)::int AS consumed FROM account_step_up_requests
      WHERE purpose='support_duty_assignment' AND grant_consumed_at IS NOT NULL`)).rows[0];
   assert.equal(steps.consumed,5);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM support_tickets')).rows[0].n,0);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM operational_incidents')).rows[0].n,0);
   assert.equal((await db.query(`SELECT count(*)::int AS n FROM notification_outbox WHERE kind<>'account_step_up'`)).rows[0].n,0);
  }finally{await new Promise(resolve=>api?.close(resolve)??resolve());await db.close();}
 });
});
