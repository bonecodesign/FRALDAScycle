import assert from 'node:assert/strict';
import test from 'node:test';
import { sellerSettlementReadiness } from '../packages/contracts/settlement-readiness.js';
import { createLogisticsService } from '../apps/api/logistics-service.js';
import { createPaymentRepository } from '../database/payment-repository.js';
import { createLogisticsRepository } from '../database/logistics-repository.js';
const now = Date.parse('2030-01-10T12:00:00Z');
const ready = { id: 'proof', kind: 'sale', shipment_status: 'delivered', transaction_status: 'in_delivery',
  paid_count: 1, payment_blocked: false, financial_case_pending: false,
  approved_at: '2030-01-09T10:00:00Z', validated_at: '2030-01-09T12:00:00Z' };

test('seller snapshot requires both decisions, uses later timestamp and never allows payout', () => {
  const status = sellerSettlementReadiness(ready, now);
  assert.equal(status.requirementsMet, true);
  assert.deepEqual(status.blockers, []);
  assert.equal(status.targetDeadline, '2030-01-12T12:00:00.000Z');
  assert.equal(status.payoutAllowed, false);
  assert.equal(status.deadlineStatus, 'provider_confirmation_pending');
  const reversed = sellerSettlementReadiness({ ...ready, approved_at: ready.validated_at, validated_at: ready.approved_at }, now);
  assert.equal(reversed.targetDeadline, status.targetDeadline);
});
test('each missing requirement blocks snapshot including unknown financial data and duplicate paid intents', () => {
  const cases = [
    [{ kind: 'exchange' }, 'unsupported_transaction_kind'],
    [{ kind: 'donation' }, 'unsupported_transaction_kind'],
    [{ shipment_status: 'in_transit' }, 'delivery_proof_pending'],
    [{ id: null }, 'delivery_proof_pending'],
    [{ transaction_status: 'disputed' }, 'transaction_not_eligible'],
    [{ paid_count: 0 }, 'payment_not_confirmed'],
    [{ paid_count: 2 }, 'payment_not_confirmed'],
    [{ payment_blocked: true }, 'payment_not_confirmed'],
    [{ payment_blocked: undefined }, 'payment_not_confirmed'],
    [{ financial_case_pending: true }, 'financial_case_pending'],
    [{ financial_case_pending: undefined }, 'financial_case_pending'],
    [{ approved_at: null }, 'receiver_approval_pending'],
    [{ approved_at: 'invalid' }, 'receiver_approval_pending'],
    [{ validated_at: '2031-01-01' }, 'proof_validation_pending'],
  ];
  for (const [patch, blocker] of cases) {
    const status = sellerSettlementReadiness({ ...ready, ...patch }, now);
    assert.equal(status.requirementsMet, false);
    assert.ok(status.blockers.includes(blocker));
    assert.equal(status.payoutAllowed, false);
  }
});
test('silence and expired target do not approve receipt or allow transfer', () => {
  const silence = sellerSettlementReadiness({ ...ready, approved_at: null }, now + 864000000);
  assert.equal(silence.targetDeadline, null);
  assert.equal(silence.requirementsMet, false);
  const overdue = sellerSettlementReadiness(ready, now + 864000000);
  assert.equal(overdue.targetOverdue, true);
  assert.equal(overdue.payoutAllowed, false);
});
test('settlement query enforces same access as receipt and reveals no payment identifiers', async () => {
  let input;
  const service = createLogisticsService({ async receiptEvidence(value) { input = value; return ready; } }, {});
  const status = await service.settlementStatus({ id: 'buyer', role: 'customer' }, 'shipment');
  assert.equal(input.reviewer, false);
  assert.equal(status.payoutAllowed, false);
  assert.equal(status.paymentIntentId, undefined);
  const denied = createLogisticsService({ receiptEvidence: async () => null }, {});
  await assert.rejects(denied.settlementStatus({ id: 'other', role: 'customer' }, 'shipment'), error => error.code === 'receipt_not_found');
});
test('late payment events cannot regress a paid, disputed or refunded intent', async () => {
  for (const [status, type] of [['paid','payment.authorized'], ['paid','payment.failed'], ['disputed','payment.paid'], ['refunded','payment.disputed']]) {
    const calls = [];
    const repository = createPaymentRepository({ async transaction(operation) {
      return operation({ async query(sql) {
        calls.push(sql);
        if (/INSERT INTO payment_webhook_events/.test(sql)) return { rows: [{ id: 'evt' }] };
        return { rows: [{ id: 'intent', transaction_id: 'tx', amount_cents: 1000, status }] };
      } });
    } });
    assert.deepEqual(await repository.processWebhook({ id: 'evt', type, amountCents: 1000 }), { ignored: true, status });
    assert.equal(calls.length, 2);
  }
});
test('delivery events can only change paid or in-delivery transactions, preserving disputes', async () => {
  const calls = [];
  const repository = createLogisticsRepository({ async transaction(operation) {
    return operation({ async query(sql, values) {
      calls.push({ sql, values });
      if (/INSERT INTO logistics_webhook_events/.test(sql)) return { rows: [{ id: 'evt' }] };
      if (/SELECT id,transaction_id,status/.test(sql)) return { rows: [{ id: 'shipment', transaction_id: 'tx', status: 'in_transit' }] };
      return { rows: [] };
    } });
  } });
  await repository.processWebhook({ id: 'evt', type: 'shipment.delivered' });
  assert.match(calls.find(({sql}) => /UPDATE transactions/.test(sql)).sql, /status IN \('paid','in_delivery'\)/);
});

test('settlement endpoint authenticates, disables cache and never authorizes payout', async context => {
  const { createApiServer } = await import('../apps/api/server.js');
  const { loadConfig } = await import('../apps/api/config.js');
  const id = '22222222-2222-4222-8222-222222222222';
  const service = createLogisticsService({ async receiptEvidence({ userId, shipmentId, reviewer }) {
    assert.equal(shipmentId, id);
    assert.equal(reviewer, false);
    return userId === 'buyer' ? ready : null;
  } }, {});
  const server = createApiServer({ config: loadConfig({ NODE_ENV: 'test' }), logisticsService: service,
    authService: { async session(token) { return ['buyer','other'].includes(token) ? { id: token, role: 'customer' } : null; } } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  context.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/v1/shipments/${id}/settlement-status`;
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { cookie: 'fc_session=other' } })).status, 404);
  const response = await fetch(url, { headers: { cookie: 'fc_session=buyer' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).settlement.payoutAllowed, false);
});
