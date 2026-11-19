import assert from 'node:assert/strict';
import test from 'node:test';
import {firstResponseDeadline,supportPriorities} from '../packages/contracts/support-priority.js';

test('approved first response targets respect Brasília staff windows without promising coverage',()=>{
 assert.deepEqual(supportPriorities,['critical','high','normal','low']);
 assert.equal(firstResponseDeadline('2026-11-22T23:00:00.000Z','critical'),'2026-11-22T23:30:00.000Z');
 assert.equal(firstResponseDeadline('2026-11-20T22:00:00.000Z','high'),'2026-11-21T14:00:00.000Z');
 assert.equal(firstResponseDeadline('2026-11-23T12:00:00.000Z','normal'),'2026-11-24T12:00:00.000Z');
 assert.equal(firstResponseDeadline('2026-11-21T22:00:00.000Z','low'),'2026-11-24T22:00:00.000Z');
 assert.equal(firstResponseDeadline('2026-11-22T12:00:00.000Z','normal'),'2026-11-23T23:00:00.000Z');
 // Sub-minute boundaries must not skip the last 20 seconds of a working day.
 assert.equal(firstResponseDeadline('2026-11-18T22:59:40.000Z','high'),'2026-11-19T14:59:40.000Z');
 assert.throws(()=>firstResponseDeadline('invalid','high'),/creation time/);
 assert.throws(()=>firstResponseDeadline('2026-11-18T12:00:00.000Z','urgent'),/priority/);
});
