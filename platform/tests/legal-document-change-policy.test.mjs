import assert from 'node:assert/strict';
import test from 'node:test';
import {loadLegalTerms} from '../apps/api/legal-terms.js';
import {LEGAL_DOCUMENT_CHANGE_POLICY,prepareLegalDocumentChange} from '../packages/contracts/legal-document-change-policy.js';

const base={
  type:'material',currentVersion:'FC-TERMS-1.0',nextVersion:'FC-TERMS-2.0',
  contentHash:'a'.repeat(64),summary:'Alteração material sintética para validar o contrato.',
  announcedAt:'2026-11-20T12:00:00.000Z',effectiveAt:'2026-12-05T12:00:00.000Z',
  materialImpact:true,editorialScopeConfirmed:false,urgentApprovals:null,founderNotified:false,
};

test('normal material change requires fifteen full days and a new acceptance',()=>{
  const result=prepareLegalDocumentChange(base);
  assert.equal(result.noticeDays,15);
  assert.equal(result.requiresReacceptance,true);
  assert.equal(result.publicationAuthorized,false);
  assert.equal(result.publicationStatus,'prepared-not-published');
  assert.deepEqual(result.preservedCapabilities,[
    'support','data_rights','data_export','account_deletion','existing_obligations',
  ]);
  assert.throws(()=>prepareLegalDocumentChange({...base,effectiveAt:'2026-12-04T11:59:59.000Z'}),/invalid_legal_document_change/);
});

test('editorial change communicates without reacceptance only when scope is unchanged',()=>{
  const editorial=prepareLegalDocumentChange({...base,type:'editorial',materialImpact:false,
    editorialScopeConfirmed:true,effectiveAt:base.announcedAt});
  assert.equal(editorial.requiresCommunication,true);
  assert.equal(editorial.requiresReacceptance,false);
  assert.throws(()=>prepareLegalDocumentChange({...base,type:'editorial',materialImpact:true,
    editorialScopeConfirmed:true}),/invalid_legal_document_change/);
});

test('urgent change requires distinct legal and security approvals and founder notification',()=>{
  const urgent={...base,type:'urgent',effectiveAt:'2026-11-20T13:00:00.000Z',founderNotified:true,
    urgentApprovals:[
      {sector:'legal_privacy',actorId:'legal-person',approvedAt:'2026-11-20T12:10:00.000Z'},
      {sector:'security',actorId:'security-person',approvedAt:'2026-11-20T12:15:00.000Z'},
    ]};
  const result=prepareLegalDocumentChange(urgent);
  assert.equal(result.jointUrgentApprovalVerified,true);
  assert.equal(result.requiresReacceptance,true);
  assert.equal(result.finalFounderAuthorizationRequired,true);
  assert.equal(result.publicationAuthorized,false);
  assert.throws(()=>prepareLegalDocumentChange({...urgent,urgentApprovals:[
    urgent.urgentApprovals[0],{...urgent.urgentApprovals[1],actorId:'legal-person'},
  ]}),/invalid_legal_document_change/);
});

test('draft legal catalog discloses immutable change policy without claiming activation',async()=>{
  const terms=await loadLegalTerms();
  assert.equal(terms.status,'draft');
  assert.equal(terms.changePolicy,LEGAL_DOCUMENT_CHANGE_POLICY);
  assert.equal(terms.changePolicy.automaticPublicationAllowed,false);
  assert.equal(terms.changePolicy.finalPublicationAccessLevel,5);
});
