import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createDonationService} from '../apps/api/donation-service.js';
import {createMarketplaceService} from '../apps/api/marketplace-service.js';
import {createInstitutionService} from '../apps/api/institution-service.js';
import {createInstitutionAccessService} from '../apps/api/institution-access-service.js';
import {createDatabase} from '../database/client.js';
import {createDonationRepository} from '../database/donation-repository.js';
import {createMarketplaceRepository} from '../database/marketplace-repository.js';
import {createInstitutionRepository} from '../database/institution-repository.js';
import {createInstitutionAccessRepository} from '../database/institution-access-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';
import {seedDonationListing} from '../tools/beta-donation-check.mjs';
import {seedSyntheticInstitution} from '../tools/beta-institution-access-check.mjs';

const native=await nativePostgresTools();
const ids={donor:'11111111-1111-4111-8111-111111111111',representative:'22222222-2222-4222-8222-222222222222',targetRepresentative:'33333333-3333-4333-8333-333333333333',admin:'44444444-4444-4444-8444-444444444444'};
const consent={confirmed:true,noticeVersion:'FC-DONATION-1',logisticsResponsibility:'donor'};

async function prepareInstitution(database,{representative,taxId},admin){
 const institutions=createInstitutionService(createInstitutionRepository(database));
 const access=createInstitutionAccessService(createInstitutionAccessRepository(database));
 const institution=await seedSyntheticInstitution(database,representative.id,taxId);
 await institutions.changeStatus(admin.id,institution,{status:'active',reason:'Ativação fictícia para teste integrado de recusa.'});
 await access.assign(admin,institution,{userId:representative.id,expectedVersion:0,confirmed:true,reason:'Vínculo fictício para teste integrado de recusa.'});
 await access.accept(representative,institution,{expectedVersion:1,confirmed:true});
 await access.review(admin,institution,{expectedVersion:2,confirmed:true,outcome:'verified',reason:'Conferência fictícia independente para o teste.'});
 return institution;
}

test('donation refusal and donor relist, redirect or close cross HTTP and PostgreSQL with preserved history',{
 skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{
  const database=createDatabase({databaseUrl,databaseSsl:false});let api;
  try{
   await migrate(database,await discoverMigrations());
   await database.query(`INSERT INTO users(id,email,password_hash,display_name,role,email_verified_at,adult_declared_at,adult_declaration_version) VALUES
    ($1,'donor-refusal@example.test','fixture','Doador fictício','customer',now(),now(),'FC-AGE-1'),
    ($2,'representative-refusal@example.test','fixture','Representante fictício','customer',now(),now(),'FC-AGE-1'),
    ($3,'target-representative@example.test','fixture','Representante de destino fictício','customer',now(),now(),'FC-AGE-1'),
    ($4,'admin-refusal@example.test','fixture','Admin fictício','admin',now(),now(),'FC-AGE-1')`,Object.values(ids));
   const actors={donor:{id:ids.donor,role:'customer',adultDeclared:true},representative:{id:ids.representative,role:'customer',adultDeclared:true},target:{id:ids.targetRepresentative,role:'customer',adultDeclared:true},admin:{id:ids.admin,role:'admin',adultDeclared:true}};
   const institution=await prepareInstitution(database,{representative:actors.representative,taxId:'11111111111111'},actors.admin);
   const targetInstitution=await prepareInstitution(database,{representative:actors.target,taxId:'22222222222222'},actors.admin);
   await database.query('UPDATE institutions SET open_packages_accepted=true WHERE id=$1',[institution]);
   const mediaProvider={async verifyListingMedia(userId,keys){assert.equal(userId,ids.donor);assert.equal(keys.length,2);}};
   api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),donationService:createDonationService(createDonationRepository(database)),marketplaceService:createMarketplaceService(createMarketplaceRepository(database),null,mediaProvider),authService:{async session(token){return actors[token]??null;}}});
   await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
   const origin=`http://127.0.0.1:${api.address().port}`;
   const post=async(token,path,body)=>{const response=await fetch(origin+path,{method:'POST',headers:{cookie:`fc_session=${token}`,'content-type':'application/json'},body:JSON.stringify(body)});const payload=await response.json();assert.ok([200,201].includes(response.status),`${response.status} ${JSON.stringify(payload)}`);assert.equal(response.headers.get('cache-control'),'no-store');return {httpStatus:response.status,...payload.donation};};
   const listingInput={title:'Pacote aberto fictício para doação',description:'Fraldas fictícias declaradas sem uso, limpas, secas, íntegras e dentro da validade.',kind:'donation',quantity:18,priceCents:null,category:'infant',brand:'Pampers',model:'Confort Sec',packageCondition:'open',size:'M',institutionId:institution,mediaKeys:[`listings/${ids.donor}/embalagem.webp`,`listings/${ids.donor}/condicoes.webp`],idempotencyKey:'55555555-5555-4555-8555-555555555555'};
   const rejectedAttestation=await fetch(origin+'/v1/listings',{method:'POST',headers:{cookie:'fc_session=donor','content-type':'application/json'},body:JSON.stringify(listingInput)});assert.equal(rejectedAttestation.status,422);assert.equal((await rejectedAttestation.json()).error.code,'open_package_attestation_required');
   const rejectedInstitution=await fetch(origin+'/v1/listings',{method:'POST',headers:{cookie:'fc_session=donor','content-type':'application/json'},body:JSON.stringify({...listingInput,openPackageAttested:true,institutionId:targetInstitution,idempotencyKey:'66666666-6666-4666-8666-666666666666'})});assert.equal(rejectedInstitution.status,409);assert.equal((await rejectedInstitution.json()).error.code,'institution_rejects_open_packages');
   const publication=await fetch(origin+'/v1/listings',{method:'POST',headers:{cookie:'fc_session=donor','content-type':'application/json'},body:JSON.stringify({...listingInput,openPackageAttested:true})});const publicationBody=await publication.json();assert.equal(publication.status,201,JSON.stringify(publicationBody));
   const openListing=publicationBody.listing.id;
   const storedOpen=(await database.query('SELECT package_condition,open_package_attested,status FROM listings WHERE id=$1',[openListing])).rows[0];assert.deepEqual(storedOpen,{package_condition:'open',open_package_attested:true,status:'review'});
   assert.equal((await database.query('SELECT count(*)::int AS count FROM listing_media WHERE listing_id=$1',[openListing])).rows[0].count,2);
   await database.query("UPDATE listings SET status='published',published_at=now() WHERE id=$1",[openListing]); // Synthetic moderation fixture; no claim of human inspection.
   await database.query('UPDATE institutions SET open_packages_accepted=true WHERE id=$1',[targetInstitution]);
   const scenarios=[{decision:'relist',reason:'institution_capacity'},{decision:'redirect',reason:'outside_scope',targetInstitutionId:targetInstitution},{decision:'close',reason:'listing_mismatch'}];
   const results=[];
   for(const [index,scenario] of scenarios.entries()){
    const listing=index===0?openListing:await seedDonationListing(database,ids.donor,institution);
    const created=await post('donor','/v1/donations',{...consent,listingId:listing,idempotencyKey:`synthetic-http-donation-${index}`});
    assert.equal(created.httpStatus,201);assert.equal(created.version,1);
    const accepted=await post('representative',`/v1/donations/${created.transaction_id}/accept`,{...consent,expectedVersion:1});assert.equal(accepted.version,2);
    const refusal={expectedVersion:2,confirmed:true,reason:scenario.reason,note:'Recusa exclusivamente fictícia para prova integrada.',idempotencyKey:`synthetic-http-refusal-${index}`};
    const refused=await post('representative',`/v1/donations/${created.transaction_id}/refuse`,refusal);assert.equal(refused.version,3);assert.equal(refused.transaction_status,'cancelled');assert.equal(refused.refusal_reason,scenario.reason);
    const repeatedRefusal=await post('representative',`/v1/donations/${created.transaction_id}/refuse`,refusal);assert.equal(repeatedRefusal.httpStatus,200);assert.equal(repeatedRefusal.reused,true);
    const decision={expectedVersion:3,confirmed:true,decision:scenario.decision,targetInstitutionId:scenario.targetInstitutionId,idempotencyKey:`synthetic-http-decision-${index}`};
    const decided=await post('donor',`/v1/donations/${created.transaction_id}/decide`,decision);assert.equal(decided.version,4);assert.equal(decided.donor_decision,scenario.decision);assert.equal(decided.refusal_reason,scenario.reason);
    const repeatedDecision=await post('donor',`/v1/donations/${created.transaction_id}/decide`,decision);assert.equal(repeatedDecision.httpStatus,200);assert.equal(repeatedDecision.reused,true);
    results.push({listing,transaction:created.transaction_id,decided});
   }
   assert.equal(results[0].decided.listing_status,'published');assert.equal(results[1].decided.listing_status,'published');assert.equal(results[2].decided.listing_status,'removed');
   const rows=(await database.query(`SELECT d.transaction_id,d.version,d.refusal_reason,d.refusal_note,d.donor_decision,d.donor_decision_institution_id,t.status AS transaction_status,l.status AS listing_status,l.institution_id AS listing_institution_id FROM donation_operations d JOIN transactions t ON t.id=d.transaction_id JOIN listings l ON l.id=d.listing_id WHERE d.transaction_id=ANY($1::uuid[]) ORDER BY d.donor_decision`,[results.map(item=>item.transaction)])).rows;
   assert.equal(rows.length,3);for(const row of rows){assert.equal(row.version,4);assert.equal(row.transaction_status,'cancelled');assert.match(row.refusal_note,/prova integrada/);}
   assert.equal(rows.find(row=>row.donor_decision==='relist').listing_institution_id,institution);assert.equal(rows.find(row=>row.donor_decision==='redirect').listing_institution_id,targetInstitution);assert.equal(rows.find(row=>row.donor_decision==='close').listing_status,'removed');
   const audit=(await database.query(`SELECT action,count(*)::int AS count FROM audit_events WHERE entity_id=ANY($1::text[]) AND action IN('donation.institution.refused','donation.donor.relisted','donation.donor.redirected','donation.donor.closed') GROUP BY action`,[results.map(item=>item.transaction)])).rows;
   assert.deepEqual(Object.fromEntries(audit.map(row=>[row.action,row.count])),{'donation.donor.closed':1,'donation.donor.redirected':1,'donation.donor.relisted':1,'donation.institution.refused':3});
  }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
 });
});
