import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperationalIncidentService } from '../apps/api/operational-incident-service.js';
import { controlledDomain } from '../apps/api/operational-control.js';

const id='11111111-1111-4111-8111-111111111111',key='22222222-2222-4222-8222-222222222222';
test('financial operations have independent preventive domains',()=>{
  assert.equal(controlledDomain('POST',`/v1/payments/${id}/refunds`),'refunds');
  assert.equal(controlledDomain('POST',`/v1/payments/${id}/disputes`),null);
  assert.equal(controlledDomain('POST',`/v1/shipments/${id}/seller-payout`),'payouts');
  assert.equal(controlledDomain('POST',`/v1/shipments/${id}/courier-payout`),'payouts');
});

test('incident service validates creation and optimistic updates',async()=>{
  const calls=[];const repository={
    async create(input){calls.push(input);return{incident:{id,version:1},events:[],reused:false};},
    async change(input){calls.push(input);return{incident:{id,version:2}};},
    async list(input){calls.push(input);return[];},async detail(){return{incident:{id},events:[]};},
  };
  const service=createOperationalIncidentService(repository,{clock:()=>Date.parse('2026-10-29T12:00:00Z')});
  const created=await service.create({id:'admin',role:'admin'},{idempotencyKey:key,title:'Falha financeira sintética',summary:'Resumo sintético sem qualquer dado pessoal.',severity:'critical',domain:'payments'});
  assert.equal(created.incident.id,id);assert.match(calls[0].reference,/^FC-INC-20261029-/);
  await service.change({id:'admin',role:'admin'},id,{action:'contain',expectedVersion:1,note:'Contenção preventiva confirmada.'});
  assert.equal(calls[1].action,'contain');
  await assert.rejects(service.create({id:'admin',role:'admin'},{idempotencyKey:'bad',title:'Título válido aqui',summary:'Resumo sintético sem qualquer dado pessoal.',severity:'critical',domain:'payments'}),error=>error.code==='invalid_incident_idempotency_key');
});

test('privacy incidents require assessment and governed communication before resolution',async()=>{
  const calls=[];let events=[];const repository={
    async create(input){calls.push(input);return{incident:{id,version:1,domain:'privacy',severity:'high'},events:[],reused:false};},
    async change(input){calls.push(input);events.push({action:{assess_privacy:'risk_assessed',record_communication:'communication_decision'}[input.action]??input.action});return{incident:{id,version:input.expectedVersion+1,domain:'privacy',severity:'high'}};},
    async list(){return[];},async detail(){return{incident:{id,domain:'privacy',severity:'high'},events};},
  };
  const service=createOperationalIncidentService(repository,{clock:()=>Date.parse('2026-11-10T12:00:00Z')});
  const level3={id:'privacy',role:'admin',staffAccessLevel:3};
  await service.create(level3,{idempotencyKey:key,title:'Exposição potencial de dados',summary:'Registro sintético sem dados pessoais ou infantis.',severity:'high',domain:'privacy'});
  await service.change(level3,id,{action:'assess_privacy',expectedVersion:1,note:'Risco classificado para revisão independente.',assessment:{likelihood:'medium',impact:'high',affectedScope:'unknown',containsChildData:true,immediateRisk:true,investigationComplete:false}});
  await assert.rejects(service.change(level3,id,{action:'record_communication',expectedVersion:2,note:'Decisão preliminar após avaliação proporcional.',communication:{decision:'preliminary_notice_required',channels:['account'],investigationComplete:false,legalDeadlineAt:null}}),error=>error.code==='insufficient_access_level');
  await service.change({id:'reviewer',role:'admin',staffAccessLevel:4},id,{action:'record_communication',expectedVersion:2,note:'Decisão preliminar após avaliação proporcional.',communication:{decision:'preliminary_notice_required',channels:['account'],investigationComplete:false,legalDeadlineAt:null}});
  await service.change(level3,id,{action:'resolve',expectedVersion:3,note:'Incidente encerrado após avaliação e decisão registradas.'});
  assert.equal(calls.at(-1).action,'resolve');
});

test('critical privacy communication requires founder and unresolved review fails closed',async()=>{
  const repository={async list(){return[];},async detail(){return{incident:{id,domain:'privacy',severity:'critical'},events:[]};},async change(){throw new Error('must not persist');}};
  const service=createOperationalIncidentService(repository);
  const input={action:'record_communication',expectedVersion:1,note:'Comunicação crítica submetida para decisão final.',communication:{decision:'preliminary_notice_required',channels:['anpd'],investigationComplete:false,legalDeadlineAt:null}};
  await assert.rejects(service.change({id:'admin4',role:'admin',staffAccessLevel:4},id,input),error=>error.code==='insufficient_access_level');
  await assert.rejects(service.change({id:'founder',role:'admin',staffAccessLevel:5},id,{action:'resolve',expectedVersion:1,note:'Tentativa sem avaliação e decisão completas.'}),error=>error.code==='privacy_incident_review_incomplete');
});
