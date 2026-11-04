import assert from 'node:assert/strict';
import test from 'node:test';
import {maintainModerationSuspensions} from '../workers/moderation-suspensions.js';

test('moderation maintenance delegates bounded expiry without permanent punishment',async()=>{let limit;const repository={releaseExpired:async value=>{limit=value;return{released:2,restoredListings:3,permanentBansApplied:0};}};assert.deepEqual(await maintainModerationSuspensions(repository,{limit:25}),{released:2,restoredListings:3,permanentBansApplied:0});assert.equal(limit,25);});
