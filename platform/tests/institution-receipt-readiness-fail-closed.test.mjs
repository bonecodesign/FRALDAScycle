import assert from 'node:assert/strict';
import test from 'node:test';
import { institutionReceiptReadiness } from '../packages/contracts/institution-receipt-readiness.js';

const at = Date.parse('2026-11-20T15:00:00.000Z');
const approved = '2026-11-20T14:30:00.000Z';
const validated = '2026-11-20T14:31:00.000Z';
const complete = Object.freeze({
  id: 'synthetic-receipt',
  kind: 'donation',
  donation_authorized: true,
  shipment_status: 'delivered',
  transaction_status: 'in_delivery',
  approved_at: approved,
  validated_at: validated,
  financial_case_pending: false,
});

function denied(value, expected) {
  assert.equal(value.operationalRequirementsMet, false);
  assert.equal(value.requirementsMet, false);
  assert.equal(value.payoutAllowed, false);
  assert.equal(value.payoutStatus, 'not_applicable');
  assert.equal(value.logisticsResponsibility, 'institution');
  assert.ok(value.blockers.includes('institutional_pickup_pending'));
  assert.ok(value.blockers.includes(expected), 'missing blocker ' + expected);
}

test('OPS-03: valid synthetic receipt remains an internal check, never a payout or launch authorization', () => {
  const result = institutionReceiptReadiness(complete, at);
  assert.equal(result.operationalRequirementsMet, true);
  assert.equal(result.requirementsMet, false);
  assert.deepEqual(result.blockers, ['institutional_pickup_pending']);
  assert.equal(result.payoutAllowed, false);
  assert.equal(result.payoutStatus, 'not_applicable');
  assert.equal(result.logisticsResponsibility, 'institution');
  assert.equal(Object.hasOwn(result, 'courierAmountCents'), false);
});

test('OPS-03: missing and malformed evidence returns a denial, never throws or approves an operation', () => {
  for (const input of [null, undefined, false, 0, '', [], 'synthetic', 42]) {
    denied(institutionReceiptReadiness(input, at), 'institution_receipt_evidence_unavailable');
  }
  denied(institutionReceiptReadiness({}, at), 'institution_authority_pending');
});

test('OPS-03: non-temporal approval and validation fields never count as real evidence', () => {
  for (const field of ['approved_at', 'validated_at']) {
    for (const invalid of [null, false, 0, 1, 1234567890, {}, [], new Date('invalid')]) {
      const result = institutionReceiptReadiness({ ...complete, [field]: invalid }, at);
      denied(result, field === 'approved_at'
        ? 'institution_approval_pending'
        : 'independent_proof_validation_pending');
    }
  }
});

test('OPS-03: missing clock certainty, future evidence, or reversed approval order fails closed', () => {
  for (const invalid of [NaN, Infinity, 'unknown', new Date('invalid')]) {
    denied(institutionReceiptReadiness(complete, invalid), 'receipt_clock_unavailable');
  }
  denied(institutionReceiptReadiness({
    ...complete, approved_at: '2026-11-20T15:00:01.000Z',
    validated_at: '2026-11-20T15:00:02.000Z',
  }, at), 'institution_approval_pending');
  denied(institutionReceiptReadiness({
    ...complete, validated_at: '2026-11-20T14:29:59.000Z',
  }, at), 'institution_validation_precedes_approval');
  assert.equal(institutionReceiptReadiness({
    ...complete, approved_at: new Date(approved), validated_at: new Date(validated),
  }, new Date(at)).operationalRequirementsMet, true);
});

test('OPS-02/03: expired institution authority, open operational case, and wrong transaction type stay blocked', () => {
  const cases = [
    [{ donation_authorized: false }, 'institution_authority_pending'],
    [{ donation_authorized: null }, 'institution_authority_pending'],
    [{ financial_case_pending: null }, 'operational_issue_pending'],
    [{ financial_case_pending: true }, 'operational_issue_pending'],
    [{ shipment_status: 'in_transit' }, 'delivery_proof_pending'],
    [{ transaction_status: 'cancelled' }, 'transaction_not_eligible'],
    [{ kind: 'sale' }, 'unsupported_transaction_kind'],
  ];
  for (const [change, expected] of cases) {
    denied(institutionReceiptReadiness({ ...complete, ...change }, at), expected);
  }
});
