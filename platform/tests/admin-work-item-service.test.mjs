import assert from 'node:assert/strict';
import test from 'node:test';
import {createAdminWorkItemService,maskCrossSectorContext} from '../apps/api/admin-work-item-service.js';

const actor={id:'11111111-1111-4111-8111-111111111111',role:'admin',staffAccessLevel:3,staffSector:'finance'};

test('masks personal and credential-like content before cross-sector persistence',()=>{
  const masked=maskCrossSectorContext('CPF 123.456.789-00, ana@example.com, (31) 99999-9999, sk_test_abcdefghijklmnop');
  assert.equal(masked.includes('123.456.789-00'),false);
  assert.equal(masked.includes('ana@example.com'),false);
  assert.equal(masked.includes('99999-9999'),false);
  assert.equal(masked.includes('abcdefghijklmnop'),false);
  assert.match(masked,/CPF mascarado/);
});

test('creates a minimized work item and never accepts attachments',async()=>{
  let persisted;
  const service=createAdminWorkItemService({create:async input=>(persisted=input),list:async()=>({items:[]})});
  await service.create(actor,{sector:'support',kind:'refund_review',title:'Analisar reembolso',context:'contato ana@example.com',priority:'high'});
  assert.equal(persisted.actorId,actor.id);
  assert.equal(persisted.sector,'support');
  assert.equal(persisted.context.includes('ana@example.com'),false);
  assert.throws(()=>service.create(actor,{sector:'support',kind:'refund_review',title:'Analisar reembolso',priority:'high',attachments:[]}),/anexos/i);
});

test('exposes the status-only cross-sector policy to authenticated staff',()=>{
  const service=createAdminWorkItemService({});
  assert.deepEqual(service.policy(actor),{actorLevel:3,actorSector:'finance',crossSectorDetails:false,attachmentsBetweenSectors:false,founderFullView:false});
});

test('validates filters, optimistic versions and transition notes before repository access',()=>{
  const service=createAdminWorkItemService({list:async input=>input,claim:async input=>input,transition:async input=>input});
  assert.throws(()=>service.list(actor,{status:'invented'}),error=>error.code==='invalid_work_item_filter');
  assert.throws(()=>service.claim(actor,'not-a-uuid',{expectedVersion:0}),error=>error.code==='invalid_admin_work_item_claim');
  assert.throws(()=>service.transition(actor,'22222222-2222-4222-8222-222222222222',{expectedVersion:0,status:'triage',note:'curta'}),error=>error.code==='invalid_admin_work_item');
});
