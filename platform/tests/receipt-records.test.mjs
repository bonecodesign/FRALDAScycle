import assert from 'node:assert/strict';
import test from 'node:test';
import { createReceiptRepository } from '../database/receipt-repository.js';
import { createLogisticsService } from '../apps/api/logistics-service.js';
import { createApiServer } from '../apps/api/server.js';
import { loadConfig } from '../apps/api/config.js';

const shipmentId = '22222222-2222-4222-8222-222222222222';
const row = { status: 'delivered', buyer_id: 'buyer', seller_id: 'seller', courier_id: 'courier',
  transaction_status: 'in_delivery', kind: 'sale', proof_id: 'proof-1' };
function database(context = row, duplicate = false) {
  const calls = [];
  const client = { async query(sql, values) {
    calls.push({ sql, values });
    if (/FOR UPDATE OF s,t/.test(sql)) return { rows: context ? [context] : [] };
    if (/INSERT INTO delivery_(receipt_approvals|proof_validations)/.test(sql)) return { rows: duplicate ? [] : [{ recorded_at: '2030-01-01T00:00:00Z' }] };
    if (/SELECT .* AS recorded_at FROM delivery_/.test(sql)) return { rows: [{ recorded_at: '2030-01-01T00:00:00Z' }] };
    return { rows: [] };
  } };
  return { calls, async transaction(operation) { return operation(client); }, query: client.query };
}

test('buyer approval and independent validation are separate, audited, and never pay out', async () => {
  for (const validation of [false, true]) {
    const db = database();
    const result = await createReceiptRepository(db).recordReceiptDecision({
      actorId: validation ? 'admin' : 'buyer', shipmentId, validation, reason: 'Foto conferida pela administração.',
    });
    assert.equal(result.reused, false);
    assert.equal(db.calls.length, 3);
    assert.match(db.calls[1].sql, validation ? /INSERT INTO delivery_proof_validations/ : /INSERT INTO delivery_receipt_approvals/);
    assert.equal(db.calls[2].values[1], validation ? 'shipment.proof.validated' : 'shipment.receipt.approved');
    assert.ok(db.calls.every(({ sql }) => !/UPDATE transactions|payment_intents|payout/.test(sql)));
  }
});

test('only receiver can approve; participants cannot validate their own delivery', async () => {
  for (const actorId of ['seller', 'courier', 'outsider']) {
    const db = database();
    await assert.rejects(createReceiptRepository(db).recordReceiptDecision({ actorId, shipmentId }),
      error => error.code === 'receipt_not_found');
    assert.equal(db.calls.length, 1);
  }
  for (const actorId of ['buyer', 'seller', 'courier']) {
    await assert.rejects(createReceiptRepository(database()).recordReceiptDecision({ actorId, shipmentId, validation: true }),
      error => error.code === 'independent_validation_required');
  }
});

test('no approval without proof, delivery or eligible transaction; exchange leg uses the same receipt safeguards', async () => {
  for (const patch of [{ proof_id: null }, { status: 'in_transit' }, { transaction_status: 'cancelled' }]) {
    const db = database({ ...row, ...patch });
    await assert.rejects(createReceiptRepository(db).recordReceiptDecision({ actorId: 'buyer', shipmentId }),
      error => error.code === 'receipt_not_ready');
    assert.equal(db.calls.length, 1);
  }
  assert.equal((await createReceiptRepository(database({ ...row, kind:'exchange' })).recordReceiptDecision({ actorId:'buyer', shipmentId })).reused,false);
});

test('retries keep original decision timestamp and do not duplicate audit', async () => {
  const db = database(row, true);
  const result = await createReceiptRepository(db).recordReceiptDecision({ actorId: 'buyer', shipmentId });
  assert.equal(result.reused, true);
  assert.equal(result.recordedAt, '2030-01-01T00:00:00Z');
  assert.ok(db.calls.every(({ sql }) => !/INSERT INTO audit_events/.test(sql)));
});

test('service requires explicit boolean approval and scoped validation with reason', async () => {
  const service = createLogisticsService({ async recordReceiptDecision() { assert.fail('invalid input must not persist'); } }, {});
  for (const approved of [undefined, false, 'true', 1]) {
    await assert.rejects(service.approveReceipt('buyer', shipmentId, { approved }), error => error.code === 'explicit_approval_required');
  }
  for (const role of ['customer', 'courier', 'moderator']) {
    await assert.rejects(service.validateProof({ id: 'reviewer', role }, shipmentId, { validated: true, reason: 'Comprovante conferido.' }),
      error => error.code === 'forbidden');
  }
  await assert.rejects(service.validateProof({ id: 'admin', role: 'admin' }, shipmentId, { validated: true, reason: 'ok' }),
    error => error.code === 'invalid_proof_validation');
});

test('evidence read limits access to parties or authorized reviewer and reports no configured payout', async () => {
  const inputs = [];
  const service = createLogisticsService({ async receiptEvidence(input) {
    inputs.push(input);
    return { id: 'proof-1', media_key: 'proofs/photo', courier_id: 'courier', created_at: '2030-01-01' };
  } }, {});
  for (const role of ['customer', 'moderator', 'admin']) {
    const proof = await service.receiptEvidence({ id: 'actor', role }, shipmentId);
    assert.equal(inputs.at(-1).reviewer, role === 'admin');
    assert.equal(proof.approvedAt, null);
    assert.equal(proof.validatedAt, null);
    assert.equal(proof.payoutStatus, 'not_configured');
    assert.equal('mediaKey' in proof, false);
  }
  const db = database();
  await createReceiptRepository(db).receiptEvidence({ userId: 'outsider', shipmentId });
  assert.deepEqual(db.calls[0].values, [shipmentId, 'outsider', false]);
  assert.match(db.calls[0].sql, /\$2 IN \(s.buyer_id,s.seller_id,s.courier_id\)/);
});

test('HTTP routes authenticate receipt writes and enforce validation scopes', async context => {
  const actors = { buyer: { id: 'buyer', role: 'customer' }, admin: { id: 'admin', role: 'admin' } };
  const writes = [];
  const logisticsService = createLogisticsService({
    async recordReceiptDecision(input) { writes.push(input); return { reused: false, recordedAt: '2030-01-01' }; },
    async receiptEvidence() { return null; },
  }, {});
  const server = createApiServer({ config: loadConfig({ NODE_ENV: 'test' }),
    authService: { async session(token) { return actors[token] ?? null; } }, logisticsService });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  context.after(() => server.close());
  const root = `http://127.0.0.1:${server.address().port}/v1/shipments/${shipmentId}`;
  const post = (path, token, body) => fetch(root + path, { method: 'POST', headers: {
    'content-type': 'application/json', ...(token ? { cookie: 'fc_session=' + token } : {}),
  }, body: JSON.stringify(body) });
  assert.equal((await post('/receipt', null, { approved: true })).status, 401);
  assert.equal((await post('/receipt', 'buyer', { approved: true })).status, 201);
  assert.equal((await post('/proof/validate', 'buyer', { validated: true, reason: 'Comprovante conferido.' })).status, 403);
  assert.equal((await post('/proof/validate', 'admin', { validated: true, reason: 'Comprovante conferido.' })).status, 201);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].actorId, 'buyer');
  assert.equal(writes[1].validation, true);
  assert.equal((await fetch(root + '/proof', { headers: { cookie: 'fc_session=buyer' } })).status, 404);
});

