import assert from 'node:assert/strict';
import test from 'node:test';
import {maintainModerationSuspensions} from '../workers/moderation-suspensions.js';

test('moderation maintenance delegates bounded expiry without permanent punishment',async()=>{let limit;const repository={releaseExpired:async value=>{limit=value;return{released:2,restoredListings:3,permanentBansApplied:0};}};assert.deepEqual(await maintainModerationSuspensions(repository,{limit:25}),{released:2,restoredListings:3,permanentBansApplied:0});assert.equal(limit,25);});

test('moderation maintenance rejects unsafe batch limits without querying the database',async()=>{
  let calls=0;
  const repository={async releaseExpired(){calls++;return {released:0,restoredListings:0,permanentBansApplied:0};}};
  for(const limit of [0,-1,1.5,51,Infinity,NaN,'10',null]){
    await assert.rejects(maintainModerationSuspensions(repository,{limit}),/1 a 50/);
  }
  assert.equal(calls,0);
  assert.deepEqual(await maintainModerationSuspensions(repository,{limit:1}),{released:0,restoredListings:0,permanentBansApplied:0});
  assert.equal(calls,1);
});
