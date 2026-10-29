import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createDonationService} from '../apps/api/donation-service.js';
import {createInstitutionAccessService} from '../apps/api/institution-access-service.js';
import {createInstitutionService} from '../apps/api/institution-service.js';
import {createLogisticsService} from '../apps/api/logistics-service.js';
import {createDatabase} from '../database/client.js';
import {createDonationRepository} from '../database/donation-repository.js';
import {createInstitutionAccessRepository} from '../database/institution-access-repository.js';
import {createInstitutionRepository} from '../database/institution-repository.js';
import {createLogisticsRepository} from '../database/logistics-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';
import {seedDonationListing} from '../tools/beta-donation-check.mjs';
import {seedSyntheticInstitution} from '../tools/beta-institution-access-check.mjs';

const native=await nativePostgresTools();
const ids={donor:'11111111-1111-4111-8111-111111111111',representative:'22222222-2222-4222-8222-222222222222',outsider:'33333333-3333-4333-8333-333333333333',courier:'44444444-4444-4444-8444-444444444444',admin:'55555555-5555-4555-8555-555555555555'};
const consent={confirmed:true,noticeVersion:'FC-DONATION-2',logisticsResponsibility:'institution'};

test('institutional receipt requires verified representative and independent validation without payout',{skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{
  const database=createDatabase({databaseUrl,databaseSsl:false});let api;
  try{
   await migrate(database,await discoverMigrations());
   await database.query(`INSERT INTO users(id,email,password_hash,display_name,role,email_verified_at,adult_declared_at,adult_declaration_version) VALUES
    ($1,'receipt-donor@example.test','fixture','Doador fictício','customer',now(),now(),'FC-AGE-1'),
    ($2,'receipt-representative@example.test','fixture','Representante fictício','customer',now(),now(),'FC-AGE-1'),
    ($3,'receipt-outsider@example.test','fixture','Pessoa externa','customer',now(),now(),'FC-AGE-1'),
    ($4,'receipt-courier@example.test','fixture','Transportador sintético','courier',now(),now(),'FC-AGE-1'),
    ($5,'receipt-admin@example.test','fixture','Admin independente','admin',now(),now(),'FC-AGE-1')`,Object.values(ids));
   const actors={donor:{id:ids.donor,role:'customer'},representative:{id:ids.representative,role:'customer'},outsider:{id:ids.outsider,role:'customer'},courier:{id:ids.courier,role:'courier'},admin:{id:ids.admin,role:'admin'}};
   const institutionId=await seedSyntheticInstitution(database,ids.representative,'33333333333333');
   const institutions=createInstitutionService(createInstitutionRepository(database)),access=createInstitutionAccessService(createInstitutionAccessRepository(database));
   await institutions.changeStatus(ids.admin,institutionId,{status:'active',reason:'Ativação exclusivamente fictícia para teste de recebimento.',verification:{documentsChecked:true,representativeChecked:true,capacityChecked:true}});
   await access.assign(actors.admin,institutionId,{userId:ids.representative,expectedVersion:0,confirmed:true,reason:'Vínculo fictício para prova de recebimento institucional.'});
   await access.accept(actors.representative,institutionId,{expectedVersion:1,confirmed:true});
   await access.review(actors.admin,institutionId,{expectedVersion:2,confirmed:true,outcome:'verified',reason:'Conferência independente exclusivamente fictícia.'});
   const donation=createDonationService(createDonationRepository(database)),listingId=await seedDonationListing(database,ids.donor,institutionId);
   const operation=await donation.create(actors.donor,{...consent,listingId,idempotencyKey:'institution-receipt-http-donation'});
   await donation.accept(actors.representative,operation.transaction_id,{...consent,expectedVersion:1});
   const shipment=await donation.pickup(actors.representative,operation.transaction_id,{...consent,idempotencyKey:'institution-receipt-http-pickup'});
   await database.query("UPDATE transactions SET status='in_delivery' WHERE id=$1",[operation.transaction_id]);
   await database.query("UPDATE shipments SET status='delivered',courier_id=$2 WHERE id=$1",[shipment.id,ids.courier]);
   await database.query(`INSERT INTO delivery_proofs(shipment_id,courier_id,media_key,recipient_name,latitude,longitude) VALUES($1,$2,'synthetic/institution-receipt-proof','Representante fictício',-19.9167,-43.9345)`,[shipment.id,ids.courier]);
   const logistics=createLogisticsService(createLogisticsRepository(database),null,null);
   api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),logisticsService:logistics,authService:{async session(token){return actors[token]??null;}}});
   await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
   const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({cookie:`fc_session=${token}`,'content-type':'application/json'}),receiptUrl=`${origin}/v1/shipments/${shipment.id}/receipt`,validationUrl=`${origin}/v1/shipments/${shipment.id}/proof/validate`;
   for(const token of ['donor','outsider']){const response=await fetch(receiptUrl,{method:'POST',headers:headers(token),body:JSON.stringify({approved:true})});assert.equal(response.status,404);}
   const explicit=await fetch(receiptUrl,{method:'POST',headers:headers('representative'),body:JSON.stringify({approved:false})});assert.equal(explicit.status,422);
   const approved=await fetch(receiptUrl,{method:'POST',headers:headers('representative'),body:JSON.stringify({approved:true})}),approvedBody=await approved.json();assert.equal(approved.status,201,JSON.stringify(approvedBody));assert.equal(approvedBody.decision.reused,false);
   const replay=await fetch(receiptUrl,{method:'POST',headers:headers('representative'),body:JSON.stringify({approved:true})});assert.equal(replay.status,200);assert.equal((await replay.json()).decision.reused,true);
   const participantValidation=await fetch(validationUrl,{method:'POST',headers:headers('representative'),body:JSON.stringify({validated:true,reason:'Tentativa da própria participante.'})});assert.equal(participantValidation.status,403);
   const validation=await fetch(validationUrl,{method:'POST',headers:headers('admin'),body:JSON.stringify({validated:true,reason:'Comprovante sintético conferido de forma independente.'})}),validationBody=await validation.json();assert.equal(validation.status,201,JSON.stringify(validationBody));
   const statusResponse=await fetch(`${origin}/v1/shipments/${shipment.id}/settlement-status`,{headers:headers('admin')}),statusBody=await statusResponse.json();assert.equal(statusResponse.status,200,JSON.stringify(statusBody));assert.equal(statusBody.settlement.operationalRequirementsMet,true);assert.equal(statusBody.settlement.requirementsMet,false);assert.equal(statusBody.settlement.payoutAllowed,false);assert.deepEqual(statusBody.settlement.blockers,['institutional_pickup_pending']);
   const counts=(await database.query(`SELECT
    (SELECT count(*)::int FROM delivery_receipt_approvals) AS approvals,
    (SELECT count(*)::int FROM delivery_proof_validations) AS validations,
    (SELECT count(*)::int FROM payment_intents WHERE transaction_id=$1) AS payments,
    (SELECT count(*)::int FROM courier_payout_obligations WHERE shipment_id=$2) AS courier_payouts,
    (SELECT count(*)::int FROM seller_payout_obligations WHERE shipment_id=$2) AS seller_payouts`,[operation.transaction_id,shipment.id])).rows[0];
   assert.deepEqual(counts,{approvals:1,validations:1,payments:0,courier_payouts:0,seller_payouts:0});
   assert.equal((await database.query('SELECT status FROM transactions WHERE id=$1',[operation.transaction_id])).rows[0].status,'in_delivery');
  }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
 });
});
