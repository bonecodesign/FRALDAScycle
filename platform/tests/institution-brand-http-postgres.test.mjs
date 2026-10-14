import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createInstitutionService} from '../apps/api/institution-service.js';
import {createInstitutionAccessService} from '../apps/api/institution-access-service.js';
import {createDatabase} from '../database/client.js';
import {createInstitutionRepository} from '../database/institution-repository.js';
import {createInstitutionAccessRepository} from '../database/institution-access-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {seedSyntheticInstitution} from '../tools/beta-institution-access-check.mjs';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const ids={representative:'11111111-1111-4111-8111-111111111111',admin:'22222222-2222-4222-8222-222222222222',outsider:'33333333-3333-4333-8333-333333333333'};

test('institution brand authorization crosses HTTP and PostgreSQL with representative authority and revocation',{
 skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{
  const database=createDatabase({databaseUrl,databaseSsl:false});let api;
  try{
   await migrate(database,await discoverMigrations());
   await database.query(`INSERT INTO users(id,email,password_hash,display_name,role,email_verified_at) VALUES
    ($1,'brand-representative@example.test','fixture','Representante fictício','customer',now()),
    ($2,'brand-admin@example.test','fixture','Admin fictício','admin',now()),
    ($3,'brand-outsider@example.test','fixture','Pessoa sem vínculo','customer',now())`,Object.values(ids));
   const actors={representative:{id:ids.representative,role:'customer'},admin:{id:ids.admin,role:'admin'},outsider:{id:ids.outsider,role:'customer'}};
   const institutions=createInstitutionService(createInstitutionRepository(database));
   const repository=createInstitutionAccessRepository(database),access=createInstitutionAccessService(repository);
   const institution=await seedSyntheticInstitution(database,ids.representative,'33333333333333');
   await institutions.changeStatus(ids.admin,institution,{status:'active',reason:'Ativação fictícia para autorizar marca no teste.'});
   await access.assign(actors.admin,institution,{userId:ids.representative,expectedVersion:0,confirmed:true,reason:'Vínculo fictício para autorização de marca.'});
   await access.accept(actors.representative,institution,{expectedVersion:1,confirmed:true});
   await access.review(actors.admin,institution,{expectedVersion:2,confirmed:true,outcome:'verified',reason:'Conferência independente fictícia do representante.'});
   api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),institutionAccessService:access,authService:{async session(token){return actors[token]??null;}}});
   await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
   const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({cookie:`fc_session=${token}`,'content-type':'application/json'});
   const input={purpose:'Divulgar campanha fictícia de arrecadação de fraldas.',channels:['website','marketplace'],assets:['public_name','logo'],noticeVersion:'FC-INSTITUTION-BRAND-1',validFrom:new Date(Date.now()-60_000).toISOString(),validUntil:new Date(Date.now()+30*86400000).toISOString(),confirmed:true};
   const adminAttempt=await fetch(`${origin}/v1/institution-brand-authorizations/${institution}/authorize`,{method:'POST',headers:headers('admin'),body:JSON.stringify(input)});assert.equal(adminAttempt.status,403);assert.equal((await adminAttempt.json()).error.code,'institution_brand_authority_required');
   const invalid=await fetch(`${origin}/v1/institution-brand-authorizations/${institution}/authorize`,{method:'POST',headers:headers('representative'),body:JSON.stringify({...input,confirmed:false})});assert.equal(invalid.status,422);
   const createdResponse=await fetch(`${origin}/v1/institution-brand-authorizations/${institution}/authorize`,{method:'POST',headers:headers('representative'),body:JSON.stringify(input)});const createdBody=await createdResponse.json();assert.equal(createdResponse.status,201,JSON.stringify(createdBody));assert.equal(createdResponse.headers.get('cache-control'),'no-store');
   const authorization=createdBody.authorization;assert.equal(authorization.version,1);assert.deepEqual(authorization.channels,['website','marketplace']);assert.deepEqual(authorization.assets,['public_name','logo']);
   const second=await fetch(`${origin}/v1/institution-brand-authorizations/${institution}/authorize`,{method:'POST',headers:headers('representative'),body:JSON.stringify(input)});assert.equal(second.status,409);assert.equal((await second.json()).error.code,'institution_brand_authorization_active');
   const representativeList=await fetch(`${origin}/v1/institution-brand-authorizations`,{headers:headers('representative')});assert.equal(representativeList.status,200);assert.equal((await representativeList.json()).items.length,1);
   const adminList=await fetch(`${origin}/v1/institution-brand-authorizations`,{headers:headers('admin')});assert.equal(adminList.status,200);assert.equal((await adminList.json()).items.length,1);
   const outsiderList=await fetch(`${origin}/v1/institution-brand-authorizations`,{headers:headers('outsider')});assert.equal((await outsiderList.json()).items.length,0);
   assert.equal((await repository.publicBrandAuthorization({institutionId:institution,channel:'website',asset:'logo'})).id,authorization.id);
   assert.equal(await repository.publicBrandAuthorization({institutionId:institution,channel:'app',asset:'logo'}),null);
   const outsiderRevoke=await fetch(`${origin}/v1/institution-brand-authorizations/${authorization.id}/revoke`,{method:'POST',headers:headers('outsider'),body:JSON.stringify({expectedVersion:1,reason:'Tentativa fictícia sem autoridade institucional.',confirmed:true})});assert.equal(outsiderRevoke.status,403);
   const stale=await fetch(`${origin}/v1/institution-brand-authorizations/${authorization.id}/revoke`,{method:'POST',headers:headers('representative'),body:JSON.stringify({expectedVersion:2,reason:'Campanha fictícia encerrada pela instituição.',confirmed:true})});assert.equal(stale.status,409);
   const revocation={expectedVersion:1,reason:'Campanha fictícia encerrada pela instituição.',confirmed:true};
   const revokedResponse=await fetch(`${origin}/v1/institution-brand-authorizations/${authorization.id}/revoke`,{method:'POST',headers:headers('representative'),body:JSON.stringify(revocation)});const revokedBody=await revokedResponse.json();assert.equal(revokedResponse.status,201,JSON.stringify(revokedBody));assert.equal(revokedBody.authorization.version,2);assert.ok(revokedBody.authorization.revoked_at);
   const replay=await fetch(`${origin}/v1/institution-brand-authorizations/${authorization.id}/revoke`,{method:'POST',headers:headers('representative'),body:JSON.stringify(revocation)});assert.equal(replay.status,200);assert.equal((await replay.json()).authorization.reused,true);
   assert.equal(await repository.publicBrandAuthorization({institutionId:institution,channel:'website',asset:'logo'}),null);
   const stored=(await database.query('SELECT purpose,channels,assets,notice_version,version,revoked_by,revocation_reason FROM institution_brand_authorizations WHERE id=$1',[authorization.id])).rows[0];assert.equal(stored.version,2);assert.equal(stored.revoked_by,ids.representative);assert.match(stored.revocation_reason,/encerrada/);
   assert.equal((await database.query('SELECT count(*)::int AS count FROM institution_brand_authorization_events WHERE authorization_id=$1',[authorization.id])).rows[0].count,2);
   const audit=(await database.query("SELECT action,count(*)::int AS count FROM audit_events WHERE entity_id=$1 AND action IN('institution.brand.authorized','institution.brand.revoked') GROUP BY action",[institution])).rows;assert.deepEqual(Object.fromEntries(audit.map(row=>[row.action,row.count])),{'institution.brand.authorized':1,'institution.brand.revoked':1});
  }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
 });
});
