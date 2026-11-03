import assert from 'node:assert/strict';
import test from 'node:test';
import {runChildProfileResponsibilityRetention} from '../workers/child-profile-responsibility-retention.js';
test('responsibility retention worker stays gated and bounded',async()=>{
 await assert.rejects(runChildProfileResponsibilityRetention({mode:'serve',env:{NODE_ENV:'production',DATABASE_URL:'postgres://fixture'}}),/gates de disputa e retenção/);
 const calls=[],database={async close(){calls.push('close');}};
 const controller=new AbortController();
 await runChildProfileResponsibilityRetention({mode:'serve',env:{NODE_ENV:'production',DATABASE_URL:'postgres://fixture',FAMILY_RESPONSIBILITY_DISPUTES_ENABLED:'true',FAMILY_RESPONSIBILITY_RETENTION_ENABLED:'true'},createDb:()=>database,createRepository:()=>({async purgeExpiredEvidence(limit){calls.push(limit);return{deleted:2};}}),wait:async()=>controller.abort(),signal:controller.signal});
 assert.deepEqual(calls,[100,'close']);
});
