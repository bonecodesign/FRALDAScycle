import assert from 'node:assert/strict';
import test from 'node:test';
import {codeReviewRequirement} from '../packages/contracts/code-governance.js';
import {loadCodeGovernance} from '../tools/code-governance.mjs';
const config=await loadCodeGovernance();
test('level 2 contributes by PR and level 4 reviews ordinary code',()=>{assert.deepEqual(codeReviewRequirement(config,['platform/apps/site/home.js']),{contributorLevel:2,directMergeAllowed:false,minimumReviewerLevel:4,sensitive:[],requiresFounderApproval:false});});
test('production, security, financial and data changes require level 5',()=>{for(const file of ['.github/workflows/platform.yml','platform/apps/api/payment-service.js','platform/apps/api/authorization.js','platform/database/migrations/085_staff_access_approval.sql','platform/config/code-governance.v1.json']){const result=codeReviewRequirement(config,[file]);assert.equal(result.minimumReviewerLevel,5,file);assert.equal(result.requiresFounderApproval,true,file);}});
test('unsafe or empty paths are rejected',()=>{assert.throws(()=>codeReviewRequirement(config,[]));assert.throws(()=>codeReviewRequirement(config,['../secret']));});
