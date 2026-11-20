import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {inspectSupportChannelReadiness,validateSupportChannelReadiness} from '../tools/support-channel-readiness.mjs';

const source=JSON.parse(await readFile(new URL('../config/support-channel-readiness.v1.json',import.meta.url),'utf8'));

test('support readiness recognizes local protocol without claiming external channels',async()=>{
  const {plan:unused,...report}=await inspectSupportChannelReadiness();
  assert.deepEqual(report,{valid:true,errors:[],requirementId:51,state:'prepared-not-activated',
    inAppReady:true,externalChannelsReady:false,activationAuthorized:false});
});

test('support readiness fails closed on invented channel, staffing or activation claims',async()=>{
  const mutations=[
    value=>{value.email.officialDomain='example.test';},
    value=>{value.email.credentialsConfigured=true;},
    value=>{value.whatsapp.scope='general-support';},
    value=>{value.whatsapp.templateApproved=true;},
    value=>{value.operations.primaryAssigned=true;},
    value=>{value.operations.privacyApproved=true;},
    value=>{value.activation.externalDispatchAuthorized=true;},
    value=>{value.activation.founderAuthorizationRecorded=true;},
  ];
  for(const mutate of mutations){
    const changed=structuredClone(source);mutate(changed);
    const report=await validateSupportChannelReadiness(changed);
    assert.equal(report.valid,false);
    assert.equal(report.activationAuthorized,false);
  }
});

test('support readiness rejects unknown fields and missing policy reference',async()=>{
  const unknown=structuredClone(source);unknown.email.secret='must-not-exist';
  assert.equal((await validateSupportChannelReadiness(unknown)).valid,false);
  const missing=structuredClone(source);missing.policyReference='docs/missing.md';
  assert.equal((await validateSupportChannelReadiness(missing)).valid,false);
});
