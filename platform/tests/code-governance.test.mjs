import assert from 'node:assert/strict';
import test from 'node:test';
import {codeReviewRequirement} from '../packages/contracts/code-governance.js';
import {loadCodeGovernance} from '../tools/code-governance.mjs';
const config=await loadCodeGovernance();
test('level 2 contributes by PR and level 4 reviews ordinary code',()=>{assert.deepEqual(codeReviewRequirement(config,['platform/apps/site/home.js']),{contributorLevel:2,directMergeAllowed:false,minimumReviewerLevel:4,sensitive:[],requiresFounderApproval:false});});
test('production, security, financial and data changes require level 5',()=>{for(const file of ['.github/workflows/platform.yml','platform/apps/api/payment-service.js','platform/apps/api/authorization.js','platform/database/migrations/085_staff_access_approval.sql','platform/config/code-governance.v1.json']){const result=codeReviewRequirement(config,[file]);assert.equal(result.minimumReviewerLevel,5,file);assert.equal(result.requiresFounderApproval,true,file);}});
test('unsafe or empty paths are rejected',()=>{assert.throws(()=>codeReviewRequirement(config,[]));assert.throws(()=>codeReviewRequirement(config,['../secret']));});

test('governance escalates incident controls, pilot gates, notification workers and formal matrix',()=>{
 const sensitive=[
  'platform/apps/api/operational-control.js',
  'platform/apps/api/incident-drill-signoff.js',
  'platform/apps/api/account-closure-repository.js',
  'platform/apps/api/meta-whatsapp-incident-adapter.js',
  'platform/apps/api/notifications.js',
  'platform/apps/admin/incident-console.js',
  'platform/workers/notifications.js',
  'platform/database/operational-control-repository.js',
  'platform/packages/contracts/incident-drill.js',
  'platform/tools/pilot-technical-preflight.mjs',
  'platform/tools/preactivation-safety.mjs',
  'platform/tools/code-governance.mjs',
  'platform/docs/requirements-matrix.json',
  'platform/docs/decisions/FC-DEC-2026-10-29-responsaveis-incidentes.md',
  'platform/docs/repository-access-governance.md',
  '.github/CODEOWNERS',
  '.github/workflows/platform.yml',
  'index.html',
 ];
 for(const file of sensitive){
  const result=codeReviewRequirement(config,[file]);
  assert.deepEqual(result.sensitive,[file],file);
  assert.equal(result.requiresFounderApproval,true,file);
  assert.equal(result.directMergeAllowed,false,file);
  assert.equal(result.minimumReviewerLevel,5,file);
 }
 assert.equal(codeReviewRequirement(config,['platform/apps/site/home.js']).minimumReviewerLevel,4);
});

test('governance refuses malformed paths and ambiguous policies before classification',()=>{
 for(const path of ['../secret','platform/../index.html','platform//apps/site/home.js','platform/./apps/site/home.js','platform\\apps\\api\\secrets.js','/platform/apps/site/home.js','platform/apps/site/x.js\n','platform/apps/site/home.js ']){
  assert.throws(()=>codeReviewRequirement(config,[path]),/Changed repository files/,JSON.stringify(path));
 }
 assert.throws(()=>codeReviewRequirement({...config,sensitivePrefixes:[...config.sensitivePrefixes,config.sensitivePrefixes[0]]},['platform/apps/site/home.js']),/Invalid code governance configuration/);
 assert.throws(()=>codeReviewRequirement({...config,sensitivePrefixes:['../']},['platform/apps/site/home.js']),/Invalid code governance configuration/);
});
