import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperationSupportRepository } from '../database/operation-support-repository.js';
import { previewSupportEscalation } from '../packages/contracts/support-escalation-preview.js';

const id = '11111111-1111-4111-8111-111111111111';
const overdueTicket = {
  id, protocol: 'FC-SYNTHETIC-001', category: 'general', subject: 'Atendimento fictício',
  status: 'open', priority: 'critical',
  first_response_due_at: '2026-11-20T14:00:00.000Z',
  first_response_at: null, assignee_id: null, created_at: '2026-11-20T12:00:00.000Z',
};

test('FC-353: queue and full overdue counts use one read-only database snapshot', async () => {
  const calls = [];
  const db = { async query(sql, args) {
    calls.push({ sql, args });
    return { rows: [{ ...overdueTicket, overdue_total: 81, critical_overdue: 3 }] };
  } };
  const snapshot = await createOperationSupportRepository(db).supportAttention({ limit: 1 });
  assert.equal(calls.length, 1, 'page and counts must not use separate SQL statements');
  assert.deepEqual(calls[0].args, [1]);
  assert.match(calls[0].sql, /count\(\*\) OVER\(\)::int AS overdue_total/i);
  assert.match(calls[0].sql, /count\(\*\) FILTER \(WHERE priority='critical'\) OVER\(\)::int AS critical_overdue/i);
  assert.match(calls[0].sql, /LIMIT \$1/);
  assert.match(calls[0].sql, /FROM support_tickets/i);
  assert.doesNotMatch(calls[0].sql, /\b(INSERT|UPDATE|DELETE)\b/i);

  assert.equal(snapshot.items.length, 1);
  assert.deepEqual(snapshot.items[0], overdueTicket,
    'aggregate counters are internal and must not be repeated in ticket rows');
  assert.equal(snapshot.overdue_total, 81, 'aggregate must count all overdue tickets, not only page 1');
  assert.equal(snapshot.critical_overdue, 3);
  assert.equal(snapshot.externalDispatchAuthorized, false);
  assert.equal(snapshot.automaticPauseAuthorized, false);

  const preview = previewSupportEscalation({
    tickets: snapshot.items,
    overdueTotal: snapshot.overdue_total,
    criticalOverdue: snapshot.critical_overdue,
  });
  assert.equal(preview.preventionPreview.threeCriticalOverdue, true);
  assert.equal(preview.preventionPreview.humanDecisionRequired, true);
  assert.equal(preview.routes[0].readiness, 'missing_coverage');
  assert.equal(preview.sendAttempted, false);
  assert.equal(preview.internalDispatchAuthorized, false);
  assert.equal(preview.externalDispatchAuthorized, false);
  assert.equal(preview.automaticPauseAuthorized, false);
});

test('FC-353: no overdue tickets produces zero counters without a second query or empty row', async () => {
  const calls = [];
  const snapshot = await createOperationSupportRepository({
    async query(sql, args) {
      calls.push({ sql, args });
      return { rows: [] };
    },
  }).supportAttention({ limit: 50 });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, [50]);
  assert.deepEqual(snapshot, {
    items: [], overdue_total: 0, critical_overdue: 0,
    externalDispatchAuthorized: false, automaticPauseAuthorized: false,
  });
  const preview = previewSupportEscalation({
    tickets: snapshot.items,
    overdueTotal: snapshot.overdue_total,
    criticalOverdue: snapshot.critical_overdue,
  });
  assert.deepEqual(preview.routes, []);
  assert.equal(preview.preventionPreview.humanDecisionRequired, false);
  assert.equal(preview.automaticPauseAuthorized, false);
});
