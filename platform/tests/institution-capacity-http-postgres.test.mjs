import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createInstitutionService} from '../apps/api/institution-service.js';
import {createInstitutionAccessService} from '../apps/api/institution-access-service.js';
import {createDatabase} from '../database/client.js';
import {createInstitutionRepository} from '../database/institution-repository.js';
import {createInstitutionAccessRepository} from '../database/institution-access-repository.js';
import {createMarketplaceRepository} from '../database/marketplace-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {seedSyntheticInstitution} from '../tools/beta-institution-access-check.mjs';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const ids={representative:'11111111-1111-4111-8111-111111111111',admin:'22222222-2222-4222-8222-222222222222',outsider:'33333333-3333-4333-8333-333333333333',donor:'44444444-4444-4444-8444-444444444444'};
const listingIds={free:'55555555-5555-4555-8555-555555555555',active:'66666666-6666-4666-8666-666666666666'};

test('institution capacity pause and resume cross HTTP and PostgreSQL without abandoning active operations',{
 skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{
  const database=createDatabase({databaseUrl,databaseSsl:false});let api;
  try{
   await migrate(database,await discoverMigrations());
   await database.query(`INSERT INTO users(id,email,password_hash,display_name,role,email_verified_at) VALUES
    ($1,'capacity-representative@example.test','fixture','Representante fictício','customer',now()),
    ($2,'capacity-admin@example.test','fixture','Admin fictício','admin',now()),
    ($3,'capacity-outsider@example.test','fixture','Pessoa sem vínculo','customer',now()),
    ($4,'capacity-donor@example.test','fixture','Doador fictício','customer',now())`,Object.values(ids));
   const actors={representative:{id:ids.representative,role:'customer'},admin:{id:ids.admin,role:'admin'},outsider:{id:ids.outsider,role:'customer'}};
   const institutions=createInstitutionService(createInstitutionRepository(database));
   const repository=createInstitutionAccessRepository(database),access=createInstitutionAccessService(repository);
   const institution=await seedSyntheticInstitution(database,ids.representative,'44444444444444');
   await institutions.changeStatus(ids.admin,institution,{status:'active',reason:'Ativação fictícia para validar capacidade institucional.',verification:{documentsChecked:true,representativeChecked:true,capacityChecked:true}});
   await access.assign(actors.admin,institution,{userId:ids.representative,expectedVersion:0,confirmed:true,reason:'Vínculo fictício para controle de capacidade.'});
   await access.accept(actors.representative,institution,{expectedVersion:1,confirmed:true});
   await access.review(actors.admin,institution,{expectedVersion:2,confirmed:true,outcome:'verified',reason:'Conferência independente fictícia do representante.'});
   await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,open_package_attested,size,quantity,kind,status,city,state,institution_id,published_at)
    VALUES($1,$3,'Doação livre fictícia','Pacote sintético sem operação.','infant','Marca fictícia','Modelo fictício','sealed',false,'M',1,'donation','published','Belo Horizonte','MG',$4,now()),
          ($2,$3,'Doação em andamento fictícia','Pacote sintético com operação preservada.','infant','Marca fictícia','Modelo fictício','sealed',false,'M',1,'donation','published','Belo Horizonte','MG',$4,now())`,[listingIds.free,listingIds.active,ids.donor,institution]);
   await database.query("INSERT INTO transactions(listing_id,buyer_id,seller_id,status,amount_cents) VALUES($1,$2,$3,'proposed',0)",[listingIds.active,ids.representative,ids.donor]);
   api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),institutionAccessService:access,authService:{async session(token){return actors[token]??null;}}});
   await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
   const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({cookie:`fc_session=${token}`,'content-type':'application/json'}),url=`${origin}/v1/institution-capacity/${institution}`;
   const outsider=await fetch(url,{headers:headers('outsider')});assert.equal(outsider.status,403);assert.equal((await outsider.json()).error.code,'institution_capacity_authority_required');
   const initial=await fetch(url,{headers:headers('representative')});const initialBody=await initial.json();assert.equal(initial.status,200);assert.equal(initial.headers.get('cache-control'),'no-store');assert.equal(initialBody.capacity.accepting_donations,true);assert.equal(initialBody.capacity.version,1);
   const invalid=await fetch(url,{method:'PUT',headers:headers('representative'),body:JSON.stringify({acceptingDonations:false,expectedVersion:1,reason:'curto',confirmed:true})});assert.equal(invalid.status,422);
   const pause={acceptingDonations:false,expectedVersion:1,reason:'Armazenamento fictício temporariamente indisponível.',confirmed:true};
   const pausedResponse=await fetch(url,{method:'PUT',headers:headers('representative'),body:JSON.stringify(pause)});const paused=await pausedResponse.json();assert.equal(pausedResponse.status,200,JSON.stringify(paused));assert.equal(paused.capacity.version,2);assert.equal(paused.capacity.accepting_donations,false);
   const stale=await fetch(url,{method:'PUT',headers:headers('representative'),body:JSON.stringify({...pause,reason:'Outra justificativa fictícia para conflito.'})});assert.equal(stale.status,409);assert.equal((await stale.json()).error.code,'institution_capacity_version_conflict');
   assert.equal(await createMarketplaceRepository(database).activeInstitution(institution),null);
   const states=(await database.query('SELECT id,status FROM listings WHERE institution_id=$1 ORDER BY title',[institution])).rows;assert.equal(states.filter(row=>row.status==='paused').length,1);assert.equal(states.filter(row=>row.status==='published').length,1);
   assert.equal((await database.query("SELECT count(*)::int AS count FROM transactions WHERE listing_id=$1 AND status='proposed'",[listingIds.active])).rows[0].count,1);
   const resumedResponse=await fetch(url,{method:'PUT',headers:headers('representative'),body:JSON.stringify({acceptingDonations:true,expectedVersion:2,reason:'Espaço fictício novamente disponível para recebimento.',confirmed:true})});const resumed=await resumedResponse.json();assert.equal(resumedResponse.status,200,JSON.stringify(resumed));assert.equal(resumed.capacity.version,3);assert.equal(resumed.capacity.accepting_donations,true);
   assert.equal((await database.query("SELECT count(*)::int AS count FROM listings WHERE institution_id=$1 AND status='paused'",[institution])).rows[0].count,1);
   const events=(await database.query('SELECT accepting_donations,version FROM institution_capacity_events WHERE institution_id=$1 ORDER BY version',[institution])).rows;assert.deepEqual(events.map(row=>[row.accepting_donations,row.version]),[[false,2],[true,3]]);
   assert.equal((await database.query("SELECT count(*)::int AS count FROM audit_events WHERE entity_id=$1 AND action='institution.capacity.changed'",[institution])).rows[0].count,2);
  }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
 });
});
