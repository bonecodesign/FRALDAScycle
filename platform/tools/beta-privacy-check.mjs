import assert from 'node:assert/strict';
import {createPrivacyRequestRepository} from '../database/privacy-request-repository.js';
import {createPrivacyRequestService} from '../apps/api/privacy-request-service.js';
export async function validateSyntheticPrivacy(database,{user,other}){
  const service=createPrivacyRequestService(createPrivacyRequestRepository(database)),owner={id:user,role:'customer'},foreign={id:other,role:'customer'},admin={id:'10000000-0000-4000-8000-000000000003',role:'admin'};
  const input={kind:'deletion',details:'Solicitação fictícia de exclusão sem dados privados no pedido.',confirmed:true,idempotencyKey:'synthetic-privacy-delete-primary'};
  const before=(await database.query('SELECT count(*)::int AS count FROM users')).rows[0].count;
  const requests=await Promise.all([service.create(owner,input),service.create(owner,input)]);assert.equal(requests.filter(r=>!r.reused).length,1);assert.equal(requests[0].id,requests[1].id);assert.equal(requests[0].closureAllowed,false);assert.equal(requests[0].erasureAllowed,false);
  await assert.rejects(service.create(foreign,input),e=>e.code==='privacy_key_conflict');
  await assert.rejects(service.create(owner,{...input,kind:'access'}),e=>e.code==='privacy_key_conflict');
  await assert.rejects(service.detail(foreign,requests[0].id),e=>e.status===404);
  assert.equal((await service.list(foreign)).some(r=>r.id===requests[0].id),false);
  const detail=await service.detail(owner,requests[0].id);assert.ok(detail.currentObligations.financial_records>0);assert.equal(detail.currentObligations.erasureAllowed,false);
  const assessment={expectedVersion:0,confirmed:true,reason:'Pendências fictícias conferidas; política de retenção aguarda revisão.'};
  await assert.rejects(service.assess({id:user,role:'admin'},requests[0].id,assessment),e=>e.code==='privacy_independent_review_required');
  const results=await Promise.all([service.assess(admin,requests[0].id,assessment),service.assess(admin,requests[0].id,assessment)]);assert.equal(results.filter(r=>!r.reused).length,1);assert.equal(results[0].version,1);
  await assert.rejects(service.assess(admin,requests[0].id,{...assessment,reason:'Outro encaminhamento fictício sobre a mesma versão.'}),e=>e.code==='privacy_version_conflict');
  const after=await service.detail(owner,requests[0].id);assert.equal(after.assessments.length,1);assert.equal(after.status,'under_review');assert.equal(after.closureAllowed,false);assert.equal(after.erasureAllowed,false);
  assert.equal((await database.query('SELECT count(*)::int AS count FROM users')).rows[0].count,before);
  const access=await service.create(foreign,{...input,kind:'access',idempotencyKey:'synthetic-privacy-access-primary'});assert.equal(access.kind,'access');
  const correction=await service.create(foreign,{...input,kind:'correction',idempotencyKey:'synthetic-privacy-correction-primary'});assert.equal(correction.kind,'correction');
  const audit=JSON.stringify((await database.query("SELECT metadata FROM audit_events WHERE action LIKE 'privacy.%'")).rows);assert.equal(audit.includes(input.details),false);assert.equal(audit.includes(assessment.reason),false);
  console.log('BETA_PRIVACY: três tipos de solicitação, protocolo concorrente, identidade, isolamento, análise independente/versionada, auditoria mínima e zero exclusão/encerramento em PostgreSQL; retenção bloqueada pela revisão.');
}
