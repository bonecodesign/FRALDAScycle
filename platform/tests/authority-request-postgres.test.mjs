import assert from 'node:assert/strict';
import test from 'node:test';
import {createAuthorityRequestRepository} from '../database/authority-request-repository.js';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';
const native=await nativePostgresTools();
test('PostgreSQL enforces ordinary and judicial authority sequences without storing disclosed data',{skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60_000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{const database=createDatabase({databaseUrl,databaseSsl:false});try{
  await migrate(database,await discoverMigrations());
  const users=['11111111-1111-4111-8111-111111111111','21111111-1111-4111-8111-111111111111','31111111-1111-4111-8111-111111111111','41111111-1111-4111-8111-111111111111','51111111-1111-4111-8111-111111111111'];
  for(let index=0;index<users.length;index++)await database.query("INSERT INTO users(id,email,password_hash,display_name,role,staff_access_level,adult_declaration_version,adult_declared_at) VALUES($1,$2,'fixture',$3,'admin',$4,'FC-AGE-1',now())",[users[index],'authority-'+index+'@example.test','Nível '+(index+1),index+1]);
  const repository=createAuthorityRequestRepository(database),base={authorityName:'Autoridade fictícia',authorityReference:'OFÍCIO-TESTE',scope:'Escopo mínimo estritamente necessário.',legalBasis:'Fundamento legal formalmente verificado.'};
  const ordinary=await repository.protocol({actorId:users[0],flow:'ordinary',...base,judicialOrderReference:null});
  assert.equal((await repository.validate({actorId:users[1],requestId:ordinary.id,valid:true,note:'Identidade, competência, fundamento e escopo válidos.'})).status,'pending_authorization');
  const ordinaryResult=await repository.decide({actorId:users[2],requestId:ordinary.id,stage:'authorize',approved:true,note:'Divulgação mínima autorizada.'});assert.equal(ordinaryResult.disclosureAuthorized,true);
  assert.equal((await database.query("SELECT count(*)::int AS n FROM account_notices WHERE kind='authority_request'")).rows[0].n,2);
  const exceptional=await repository.protocol({actorId:users[0],flow:'judicial_exception',...base,judicialOrderReference:'ORDEM-JUDICIAL-TESTE'});
  await repository.validate({actorId:users[1],requestId:exceptional.id,valid:true,note:'Ordem, identidade e competência verificadas.'});
  assert.equal(await repository.decide({actorId:users[3],requestId:exceptional.id,stage:'level4',approved:true,note:'Tentativa fora da sequência.'}),null);
  assert.equal((await repository.decide({actorId:users[2],requestId:exceptional.id,stage:'legal',approved:true,note:'Jurídico confirmou validade da ordem.'})).request.status,'pending_level3');
  assert.equal((await repository.decide({actorId:users[2],requestId:exceptional.id,stage:'level3',approved:true,note:'Nível três autorizou a escalada.'})).request.status,'pending_level4');
  assert.equal((await repository.decide({actorId:users[3],requestId:exceptional.id,stage:'level4',approved:true,note:'Nível quatro conferiu o escopo.'})).request.status,'pending_level5');
  assert.equal((await repository.decide({actorId:users[4],requestId:exceptional.id,stage:'level5',approved:true,note:'Fundador concedeu aprovação final.'})).disclosureAuthorized,true);
  const columns=(await database.query("SELECT column_name FROM information_schema.columns WHERE table_name IN ('authority_requests','authority_request_decisions')")).rows.map(row=>row.column_name);
  for(const forbidden of ['document','document_content','disclosed_data','personal_data'])assert.equal(columns.includes(forbidden),false);
  const audits=JSON.stringify((await database.query("SELECT metadata FROM audit_events WHERE entity_type='authority_request'")).rows);assert.equal(audits.includes('Escopo mínimo'),false);assert.equal(audits.includes('OFÍCIO-TESTE'),false);
 }finally{await database.close();}});
});
