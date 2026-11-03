import assert from 'node:assert/strict';
import test from 'node:test';
import {createChildProfileResponsibilityRepository} from '../database/child-profile-responsibility-repository.js';
import {createChildProfileRepository} from '../database/child-profile-repository.js';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';
const native=await nativePostgresTools();
test('plausibility suspends and levelled decision restores without copying child data',{skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60_000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{const database=createDatabase({databaseUrl,databaseSsl:false});try{
  await migrate(database,await discoverMigrations());
  const account='11111111-1111-4111-8111-111111111111',level1='21111111-1111-4111-8111-111111111111',level2='31111111-1111-4111-8111-111111111111',level3='41111111-1111-4111-8111-111111111111';
  await database.query(`INSERT INTO users(id,email,password_hash,display_name,role,staff_access_level,adult_declaration_version,adult_declared_at) VALUES
   ($1,'family-dispute@example.test','fixture','Família','customer',NULL,'FC-AGE-1',now()),
   ($2,'level1@example.test','fixture','Nível 1','admin',1,'FC-AGE-1',now()),
   ($3,'level2@example.test','fixture','Nível 2','admin',2,'FC-AGE-1',now()),
   ($4,'level3@example.test','fixture','Nível 3','admin',3,'FC-AGE-1',now())`,[account,level1,level2,level3]);
  const profile=(await database.query(`INSERT INTO child_profiles(account_id,birth_date,emoji,consent_version,consented_at,personalization_enabled) VALUES($1,'2025-01-01','🍼','FC-CHILD-PROFILE-1',now(),true) RETURNING id`,[account])).rows[0];
  const ticket=(await database.query(`INSERT INTO support_tickets(requester_id,category,subject,details,idempotency_key) VALUES($1,'account','Contestação de responsabilidade','Contestação sintética sem dado infantil.','family-dispute-1') RETURNING id`,[account])).rows[0];
  const repository=createChildProfileResponsibilityRepository(database);
  const opened=await repository.open({actorId:level1,profileId:profile.id,supportTicketId:ticket.id,reasonCode:'responsibility_contested',evidenceReference:'evidence:opaque_123456'});assert.equal(opened.status,'submitted');
  assert.equal(await createChildProfileRepository(database).operationProfileState(account),'active');
  const verified=await repository.verify({actorId:level2,disputeId:opened.id,plausible:true,note:'Verificação sintética suficiente.'});assert.equal(verified.status,'verified');
  assert.equal(await createChildProfileRepository(database).operationProfileState(account),'suspended');
  const suspended=(await database.query(`SELECT birth_date,personalization_enabled,responsibility_suspended_at FROM child_profiles WHERE id=$1`,[profile.id])).rows[0];assert.ok(suspended.birth_date);assert.equal(suspended.personalization_enabled,false);assert.ok(suspended.responsibility_suspended_at);
  const decided=await repository.decide({actorId:level3,disputeId:opened.id,outcome:'restore',note:'Restaurado após análise sintética.'});assert.equal(decided.outcome,'restore');
  assert.equal(await createChildProfileRepository(database).operationProfileState(account),'active');
  const retentionSeconds=(await database.query(`SELECT extract(epoch FROM evidence_delete_by-decided_at)::int AS seconds FROM child_profile_responsibility_disputes WHERE id=$1`,[opened.id])).rows[0].seconds;assert.equal(retentionSeconds,30*24*60*60);
  const columns=(await database.query(`SELECT column_name FROM information_schema.columns WHERE table_name='child_profile_responsibility_disputes'`)).rows.map(row=>row.column_name);assert.equal(columns.includes('birth_date'),false);assert.equal(columns.includes('emoji'),false);
  const notices=(await database.query(`SELECT message FROM account_notices WHERE user_id=$1 AND kind='child_profile_responsibility' ORDER BY created_at`,[account])).rows;assert.equal(notices.length,2);assert.ok(notices.every(row=>!/2025|nascimento|emoji/i.test(row.message)));
  const rejectedTicket=(await database.query(`INSERT INTO support_tickets(requester_id,category,subject,details,idempotency_key) VALUES($1,'account','Nova contestação familiar','Nova contestação sintética sem dado infantil.','family-dispute-2') RETURNING id`,[account])).rows[0];
  const rejectedOpen=await repository.open({actorId:level1,profileId:profile.id,supportTicketId:rejectedTicket.id,reasonCode:'account_takeover',evidenceReference:null});
  const rejected=await repository.verify({actorId:level2,disputeId:rejectedOpen.id,plausible:false,note:'Não foram encontrados indícios suficientes.'});assert.equal(rejected.status,'rejected');
  const rejectedRetention=(await database.query(`SELECT extract(epoch FROM evidence_delete_by-verified_at)::int AS seconds FROM child_profile_responsibility_disputes WHERE id=$1`,[rejected.id])).rows[0].seconds;assert.equal(rejectedRetention,30*24*60*60);
  assert.equal(await createChildProfileRepository(database).operationProfileState(account),'active');
 }finally{await database.close();}});
});
