import assert from 'node:assert/strict';
import test from 'node:test';
import {runUserContentRetention} from '../workers/user-content-retention.js';
test('content retention worker stays gated and only prepares external actions',async()=>{
 assert.deepEqual(await runUserContentRetention({env:{}}),{enabled:false});
 const calls=[],database={async close(){calls.push('close');}},repository={async expire(limit){calls.push(['expire',limit]);return{expired:2};},async prepareStorageActions(limit){calls.push(['prepare',limit]);return{cdnPurgeActions:3,backupExpiryActions:1};}};
 const result=await runUserContentRetention({env:{USER_CONTENT_RETENTION_ENABLED:'true',USER_CONTENT_RETENTION_MAINTENANCE_ENABLED:'true'},createDb:()=>database,createRepository:()=>repository});
 assert.deepEqual(result,{enabled:true,expired:2,cdnPurgeActions:3,backupExpiryActions:1});assert.deepEqual(calls,[['expire',100],['prepare',100],'close']);
});
test('production worker requires explicit acknowledgement',async()=>{
 await assert.rejects(runUserContentRetention({env:{NODE_ENV:'production',USER_CONTENT_RETENTION_ENABLED:'true',USER_CONTENT_RETENTION_MAINTENANCE_ENABLED:'true'}}),/ACTIVATION_ACKNOWLEDGED/);
});
