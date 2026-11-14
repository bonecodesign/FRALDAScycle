import assert from 'node:assert/strict';
import test from 'node:test';
import {createInstitutionService} from '../apps/api/institution-service.js';
import {createDatabase} from '../database/client.js';
import {createInstitutionRepository} from '../database/institution-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';
import {seedSyntheticInstitution} from '../tools/beta-institution-access-check.mjs';

const native=await nativePostgresTools();
const representative='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222';
const pilot={enabled:true,city:'Belo Horizonte',state:'MG',postalCodePrefixes:['30','31']};

test('pilot institution activation stores minimal evidence references without copying document keys to audit',{skip:!native&&!process.env.CI?'PostgreSQL local indisponível.':false,timeout:60000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{const database=createDatabase({databaseUrl,databaseSsl:false});try{
  await migrate(database,await discoverMigrations());
  await database.query(`INSERT INTO users(id,email,password_hash,display_name,role,email_verified_at) VALUES
    ($1,'activation-representative@example.test','fixture','Representante fictício','customer',now()),
    ($2,'activation-admin@example.test','fixture','Admin fictício','admin',now())`,[representative,admin]);
  const institutionId=await seedSyntheticInstitution(database,representative,'66666666666666');
  await database.query("UPDATE institutions SET postal_code='30110000' WHERE id=$1",[institutionId]);
  const service=createInstitutionService(createInstitutionRepository(database),{pilotBh:pilot});
  const verification={documentsChecked:true,representativeChecked:true,capacityChecked:true,
    documentEvidenceReference:'document-review-synthetic-001',representativeEvidenceReference:'representative-review-synthetic-001',capacityEvidenceReference:'capacity-review-synthetic-001'};
  await service.changeStatus(admin,institutionId,{status:'active',reason:'Ativação sintética para validar referências auditáveis.',verification});
  const review=(await database.query('SELECT * FROM institution_activation_reviews WHERE institution_id=$1',[institutionId])).rows[0];
  assert.equal(review.actor_user_id,admin);assert.equal(review.previous_status,'under_review');assert.equal(review.document_evidence_reference,verification.documentEvidenceReference);
  const audit=(await database.query("SELECT metadata FROM audit_events WHERE entity_id=$1 AND action='institution.status.changed'",[institutionId])).rows[0].metadata;
  assert.equal(audit.verification.evidenceReferencesRecorded,true);assert.equal(JSON.stringify(audit).includes('synthetic/private-institution-document'),false);assert.equal(JSON.stringify(audit).includes(verification.documentEvidenceReference),false);
 }finally{await database.close();}});
});
