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
