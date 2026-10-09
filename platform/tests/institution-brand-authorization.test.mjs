import assert from 'node:assert/strict';
import test from 'node:test';
import {createInstitutionAccessRepository} from '../database/institution-access-repository.js';
import {createInstitutionAccessService} from '../apps/api/institution-access-service.js';

const institutionId='11111111-1111-4111-8111-111111111111',authorizationId='22222222-2222-4222-8222-222222222222';
function database(answer){const calls=[];const client={async query(sql,values){calls.push({sql,values});return {rows:answer(sql,values)||[]};}};return {calls,async transaction(work){return work(client);},query:client.query};}
const validInput={purpose:'Divulgar campanha institucional de doação.',channels:['website'],assets:['logo'],noticeVersion:'FC-INSTITUTION-BRAND-1',validFrom:new Date(Date.now()+60_000).toISOString(),validUntil:new Date(Date.now()+30*86400000).toISOString(),confirmed:true};

test('brand consent validates explicit channels, assets, purpose and bounded validity',async()=>{
  const service=createInstitutionAccessService({authorizeBrand:value=>value});
  const result=await service.authorizeBrand({id:'representative',role:'customer'},institutionId,validInput);
  assert.deepEqual(result.channels,['website']);assert.deepEqual(result.assets,['logo']);
  for(const patch of [{confirmed:false},{channels:[]},{assets:['unknown']},{noticeVersion:'wrong'},{validUntil:new Date(Date.now()+400*86400000).toISOString()}]){
    assert.throws(()=>service.authorizeBrand({id:'representative',role:'customer'},institutionId,{...validInput,...patch}),error=>error.code==='invalid_institution_brand_authorization');
  }
});

test('only the verified representative of an active institution can authorize brand use',async()=>{
  const created={id:authorizationId,institution_id:institutionId,representative_id:'representative',version:1};
  const db=database(sql=>/SELECT id,status,representative_email/.test(sql)?[{id:institutionId,status:'active',representative_email:'rep@example.test'}]
    :/SELECT r.user_id/.test(sql)?[{user_id:'representative'}]
    :/SELECT id FROM institution_brand_authorizations/.test(sql)?[]
    :/INSERT INTO institution_brand_authorizations/.test(sql)?[created]:[]);
  const result=await createInstitutionAccessRepository(db).authorizeBrand({actorId:'representative',institutionId,purpose:validInput.purpose,channels:['website'],assets:['logo'],noticeVersion:validInput.noticeVersion,validFrom:validInput.validFrom,validUntil:validInput.validUntil});
  assert.equal(result.id,authorizationId);
  assert.ok(db.calls.some(({sql})=>/institution_brand_authorization_events/.test(sql)));
  const audit=db.calls.at(-1);assert.match(audit.sql,/institution\.brand\.authorized/);assert.ok(!JSON.stringify(audit.values).includes('rep@example.test'));
});

test('administrators can inspect but cannot consent for an institution',async()=>{
  const db=database(sql=>/SELECT id,status,representative_email/.test(sql)?[{id:institutionId,status:'active',representative_email:'rep@example.test'}]:/SELECT r.user_id/.test(sql)?[{user_id:'representative'}]:[]);
  await assert.rejects(createInstitutionAccessRepository(db).authorizeBrand({actorId:'admin',institutionId}),error=>error.code==='institution_brand_authority_required');
});

test('revocation is versioned, audited and idempotent only for the same reason',async()=>{
  const current={id:authorizationId,institution_id:institutionId,representative_id:'representative',version:1,revoked_at:null};
  const updated={...current,version:2,revoked_at:new Date(),revocation_reason:'Campanha institucional encerrada.'};
  const db=database(sql=>/SELECT \* FROM institution_brand_authorizations/.test(sql)?[current]:/SELECT r.user_id/.test(sql)?[{user_id:'representative'}]:/UPDATE institution_brand_authorizations/.test(sql)?[updated]:[]);
  const result=await createInstitutionAccessRepository(db).revokeBrand({actorId:'representative',authorizationId,expectedVersion:1,reason:'Campanha institucional encerrada.'});
  assert.equal(result.version,2);assert.ok(db.calls.some(({sql})=>/institution\.brand\.revoked/.test(sql)));
});

test('public use fails closed unless channel and asset are currently authorized',async()=>{
  const db=database((sql,values)=>/FROM institution_brand_authorizations WHERE/.test(sql)&&values[1]==='website'&&values[2]==='logo'?[{id:authorizationId,institution_id:institutionId}]:[]);
  const repository=createInstitutionAccessRepository(db);
  assert.equal((await repository.publicBrandAuthorization({institutionId,channel:'website',asset:'logo'})).id,authorizationId);
  assert.equal(await repository.publicBrandAuthorization({institutionId,channel:'app',asset:'logo'}),null);
  assert.match(db.calls[0].sql,/revoked_at IS NULL/);assert.match(db.calls[0].sql,/valid_until>now\(\)/);
});
