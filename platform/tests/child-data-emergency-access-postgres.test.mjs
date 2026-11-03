import assert from 'node:assert/strict';
import test from 'node:test';
import {createChildDataEmergencyAccessRepository} from '../database/child-data-emergency-access-repository.js';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';
const native=await nativePostgresTools();
test('double approval grants a private watermarked read for exactly fifteen minutes',{skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60_000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{const database=createDatabase({databaseUrl,databaseSsl:false});try{
  await migrate(database,await discoverMigrations());
  const account='11111111-1111-4111-8111-111111111111',requester='21111111-1111-4111-8111-111111111111',security='41111111-1111-4111-8111-111111111111',privacy='51111111-1111-4111-8111-111111111111';
  await database.query(`INSERT INTO users(id,email,password_hash,display_name,role,staff_access_level,adult_declaration_version,adult_declared_at) VALUES
   ($1,'emergency-family@example.test','fixture','Família','customer',NULL,'FC-AGE-1',now()),
   ($2,'emergency-requester@example.test','fixture','Solicitante','admin',2,'FC-AGE-1',now()),
   ($3,'emergency-security@example.test','fixture','Segurança','admin',4,'FC-AGE-1',now()),
   ($4,'emergency-privacy@example.test','fixture','Privacidade','admin',5,'FC-AGE-1',now())`,[account,requester,security,privacy]);
  const profile=(await database.query(`INSERT INTO child_profiles(account_id,birth_date,emoji,consent_version,consented_at,personalization_enabled) VALUES($1,'2025-01-01','🍼','FC-CHILD-PROFILE-1',now(),true) RETURNING id`,[account])).rows[0],repository=createChildDataEmergencyAccessRepository(database);
  const request=await repository.request({actorId:requester,profileId:profile.id,justification:'Incidente sintético exige conferência emergencial restrita.'});assert.equal(request.status,'pending');
  const first=await repository.approve({actorId:security,requestId:request.id,domain:'security',approved:true,note:'Segurança validou a necessidade.'});assert.equal(first.grant,null);
  const second=await repository.approve({actorId:privacy,requestId:request.id,domain:'privacy',approved:true,note:'Privacidade validou a minimização.'});assert.ok(second.grant);
  const ttl=(await database.query(`SELECT extract(epoch FROM expires_at-granted_at)::int AS seconds FROM child_data_emergency_access_grants WHERE id=$1`,[second.grant.id])).rows[0].seconds;assert.equal(ttl,900);
  const read=await repository.read({actorId:requester,grantId:second.grant.id,now:new Date('2030-01-01T00:00:00Z')});assert.equal(String(read.birthDate).slice(0,10),'2025-01-01');assert.match(read.watermark,new RegExp(requester));
  const log=(await database.query(`SELECT watermark FROM child_data_emergency_access_logs WHERE grant_id=$1`,[second.grant.id])).rows[0];assert.equal(log.watermark,read.watermark);
  const columns=(await database.query(`SELECT column_name FROM information_schema.columns WHERE table_name='child_data_emergency_access_logs'`)).rows.map(row=>row.column_name);assert.equal(columns.includes('birth_date'),false);
  const notice=(await database.query(`SELECT message FROM account_notices WHERE user_id=$1 AND kind='child_data_emergency_access'`,[account])).rows[0];assert.match(notice.message,/15 minutos/);assert.doesNotMatch(notice.message,/2025|nascimento/i);
  const audit=(await database.query(`SELECT metadata::text AS metadata FROM audit_events WHERE entity_id=$1 ORDER BY created_at`,[request.id])).rows;assert.ok(audit.length>=4);assert.ok(audit.every(row=>!/2025-01-01|birthDate":"2025/i.test(row.metadata)));
  await database.query(`UPDATE child_data_emergency_access_grants SET granted_at=now()-interval '16 minutes',expires_at=now()-interval '1 minute' WHERE id=$1`,[second.grant.id]);assert.equal(await repository.read({actorId:requester,grantId:second.grant.id,now:new Date()}),null);
 }finally{await database.close();}});
});
