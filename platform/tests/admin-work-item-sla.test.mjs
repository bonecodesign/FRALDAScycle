import assert from 'node:assert/strict';
import test from 'node:test';
import {firstResponseDeadline} from '../packages/contracts/admin-work-item-sla.js';

test('first-response deadlines follow the approved priority policy',()=>{
  const start='2026-11-14T12:00:00.000Z';
  assert.equal(firstResponseDeadline('critical',start),'2026-11-14T12:30:00.000Z');
  assert.equal(firstResponseDeadline('high',start),'2026-11-14T16:00:00.000Z');
  assert.equal(firstResponseDeadline('normal',start),'2026-11-16T12:00:00.000Z');
  assert.equal(firstResponseDeadline('low',start),'2026-11-17T12:00:00.000Z');
});

test('business-day deadlines skip Sunday in Brasilia',()=>{
  assert.equal(firstResponseDeadline('normal','2026-11-13T12:00:00.000Z'),'2026-11-14T12:00:00.000Z');
  assert.throws(()=>firstResponseDeadline('invented','2026-11-14T12:00:00.000Z'),/Prioridade/);
});
