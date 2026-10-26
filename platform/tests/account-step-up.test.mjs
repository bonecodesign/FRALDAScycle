import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createAccountStepUpService } from '../apps/api/account-step-up-service.js';
import { hashPassword } from '../apps/api/security.js';
import { createAccountStepUpRepository } from '../database/account-step-up-repository.js';

const user={id:'11111111-1111-4111-8111-111111111111',email:'ana@example.test',email_verified_at:'2030-01-01T00:00:00Z',disabled_at:null};
const digest=value=>createHash('sha256').update(value).digest('hex');

test('step-up validates password, binds code to purpose and returns a short grant',async()=>{
  const account={...user,password_hash:await hashPassword('correct horse battery')};let issued;
  const repository={account:async()=>account,issue:async value=>{issued=value;return'pending';},confirm:async value=>{
    assert.equal(value.purpose,'account_closure');
    assert.equal(value.tokenHash.toString('hex'),digest(`account-step-up:account_closure:${challenge}.${issued.code}`));
    return{grantId:'22222222-2222-4222-8222-222222222222',purpose:value.purpose,verifiedAt:'2030-01-01T12:01:00.000Z',expiresAt:'2030-01-01T12:10:00.000Z'};
  }};
  const service=createAccountStepUpService(repository,{clock:()=>Date.parse('2030-01-01T12:00:00Z')});
  const requested=await service.request(user,{password:'correct horse battery',purpose:'account_closure'}),challenge=requested.challenge;
  assert.equal(requested.purpose,'account_closure');assert.equal(issued.code.length,6);assert.equal(issued.expiresAt.toISOString(),'2030-01-01T12:10:00.000Z');
  const confirmed=await service.confirm(user,{challenge,code:issued.code,purpose:'account_closure'});
  assert.equal(confirmed.grantId,'22222222-2222-4222-8222-222222222222');
});

test('step-up refuses wrong password, unknown purpose and client-injected fields',async()=>{
  const account={...user,password_hash:await hashPassword('correct horse battery')};const service=createAccountStepUpService({account:async()=>account,issue:()=>assert.fail()});
  await assert.rejects(service.request(user,{password:'wrong password value',purpose:'data_export'}),error=>error.code==='invalid_credentials');
  await assert.rejects(service.request(user,{password:'correct horse battery',purpose:'payment'}),error=>error.code==='invalid_account_step_up');
  await assert.rejects(service.request(user,{password:'correct horse battery',purpose:'data_export',verified:true}),error=>error.code==='invalid_account_step_up');
});

test('step-up confirmation is generic on wrong, expired or exhausted code',async()=>{
  const service=createAccountStepUpService({confirm:async()=>null});
  await assert.rejects(service.confirm(user,{challenge:'a'.repeat(43),code:'123456',purpose:'data_export'}),error=>error.code==='invalid_account_step_up_code');
  const limited=createAccountStepUpService({confirm:async()=>({limited:true})});
  await assert.rejects(limited.confirm(user,{challenge:'a'.repeat(43),code:'123456',purpose:'data_export'}),error=>error.code==='too_many_attempts');
});

test('repository rate limits code issuance before replacing a pending challenge',async()=>{
  const calls=[];const client={async query(sql,values){calls.push({sql,values});if(sql.includes('FOR NO KEY UPDATE'))return{rows:[user]};if(sql.includes('AS requests'))return{rows:[{requests:1,cooling_down:true}]};return{rows:[]};}};
  const repository=createAccountStepUpRepository({transaction:operation=>operation(client)});
  await assert.rejects(repository.issue({userId:user.id,purpose:'data_export'}),error=>error.code==='account_step_up_limited');
  assert.equal(calls.some(({sql})=>sql.includes('INSERT INTO auth_tokens')),false);
});

test('grant consumption is purpose-bound, one-time and unexpired by SQL contract',async()=>{
  let statement;const client={query:async(sql,values)=>{statement={sql,values};return{rows:[{confirmed_at:'2030-01-01'}]};}};
  const repository=createAccountStepUpRepository({});const result=await repository.consume(client,{grantId:'grant',userId:user.id,purpose:'account_closure'});
  assert.ok(result);assert.match(statement.sql,/grant_consumed_at IS NULL/);assert.match(statement.sql,/expires_at>now\(\)/);assert.deepEqual(statement.values,['grant',user.id,'account_closure']);
});
