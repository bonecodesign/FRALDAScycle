import assert from 'node:assert/strict';
import {createInstitutionRepository} from '../database/institution-repository.js';
import {createInstitutionService} from '../apps/api/institution-service.js';
import {createInstitutionAccessRepository,verifiedInstitutionRepresentative} from '../database/institution-access-repository.js';
import {createInstitutionAccessService} from '../apps/api/institution-access-service.js';
export async function seedSyntheticInstitution(database,userId,taxId='00000000000000'){
 const email=(await database.query('SELECT email FROM users WHERE id=$1',[userId])).rows[0].email;
 await database.query('UPDATE users SET email_verified_at=now() WHERE id=$1',[userId]); // Verified-account fixture only, no e-mail sent or real identity claim.
 return (await database.query(`INSERT INTO institutions(submitted_by_user_id,legal_name,public_name,tax_id,representative_name,representative_email,city,state,address_line,postal_code,document_keys,status)
  VALUES($1,'Instituição fictícia sem registro real','Instituição fictícia de teste',$2,'Representante fictício',$3,'Belo Horizonte','MG','Endereço institucional fictício','00000000','["synthetic/private-institution-document"]','under_review') RETURNING id`,[userId,taxId,email])).rows[0].id;
}
export async function validateSyntheticInstitutionAccess(database,{user,other}){
 const institutionId=await seedSyntheticInstitution(database,other),repository=createInstitutionRepository(database),institutions=createInstitutionService(repository),access=createInstitutionAccessService(createInstitutionAccessRepository(database));
 const admin={id:'10000000-0000-4000-8000-000000000003',role:'admin'},owner={id:other,role:'customer'};
 const results=await Promise.allSettled(['active','rejected'].map(status=>repository.changeStatus({actorUserId:admin.id,institutionId,status,expectedStatus:'under_review',reason:'Revisão institucional exclusivamente fictícia.'})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='institution_status_conflict').length,1);
 if((await repository.detailAdmin(institutionId)).status==='rejected')await institutions.changeStatus(admin.id,institutionId,{status:'under_review',reason:'Reabertura sintética para preparar a representação.'});
 if((await repository.detailAdmin(institutionId)).status==='under_review')await institutions.changeStatus(admin.id,institutionId,{status:'active',reason:'Ativação sintética sem afirmar revisão humana real.',verification:{documentsChecked:true,representativeChecked:true,capacityChecked:true}});
 const input={userId:other,expectedVersion:0,reason:'Conta fictícia conferida como representante institucional.',confirmed:true};
 await assert.rejects(access.assign(admin,institutionId,{...input,userId:user}),e=>e.code==='institution_representative_identity_pending');
 await assert.rejects(access.assign({id:other,role:'admin'},institutionId,input),e=>e.code==='institution_independent_reviewer_required');
 const invited=await Promise.all([access.assign(admin,institutionId,input),access.assign(admin,institutionId,input)]);assert.equal(invited.filter(x=>!x.reused).length,1);
 const review={expectedVersion:1,outcome:'verified',reason:'Autorização representativa fictícia conferida.',confirmed:true};
 await assert.rejects(access.review(admin,institutionId,review),e=>e.code==='institution_representative_not_ready');
 await assert.rejects(access.accept({id:user},institutionId,{expectedVersion:1,confirmed:true}),e=>e.status===404);
 const accepted=await Promise.all([access.accept(owner,institutionId,{expectedVersion:1,confirmed:true}),access.accept(owner,institutionId,{expectedVersion:1,confirmed:true})]);assert.equal(accepted.filter(x=>!x.reused).length,1);
 await assert.rejects(access.review({id:other,role:'admin'},institutionId,{...review,expectedVersion:2}),e=>e.code==='institution_independent_reviewer_required');
 const verified=await Promise.all([access.review(admin,institutionId,{...review,expectedVersion:2}),access.review(admin,institutionId,{...review,expectedVersion:2})]);assert.equal(verified.filter(x=>!x.reused).length,1);
 assert.equal(await database.transaction(c=>verifiedInstitutionRepresentative(c,institutionId)),other);
 await access.review(admin,institutionId,{...review,expectedVersion:3,outcome:'revoked'});assert.equal(await database.transaction(c=>verifiedInstitutionRepresentative(c,institutionId)),null);
 assert.equal((await access.list({id:user,role:'customer'})).some(x=>x.institution_id===institutionId),false);
 assert.equal((await database.query('SELECT count(*)::int AS n FROM institution_representative_events WHERE institution_id=$1',[institutionId])).rows[0].n,4);
 console.log('BETA_INSTITUTION_ACCESS: estado institucional concorrente, conta/e-mail fictícios, convite sem mensagem externa, aceite, conferência independente e revogação versionados em PostgreSQL; sem homologação documental/identidade humana.');
}
