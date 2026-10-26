import assert from "node:assert/strict";
import test from "node:test";
import { reconcileAsaasPayment } from "../packages/contracts/asaas-payment-reconciliation.js";

const expected = { reference: "intent-0000000001", amountCents: 1234 };
const payment = {
  provider: "asaas", paymentId: "pay_123", reference: expected.reference,
  status: "RECEIVED", value: 12.34,
};

test("Asaas reconciliation matches exact reference and cents without authorizing transition", () => {
  assert.deepEqual(reconcileAsaasPayment({ expected, providerPayment: payment, checkedAt: "2030-01-01T00:00:00Z" }), {
    provider: "asaas", paymentId: "pay_123", reference: expected.reference,
    expectedAmountCents: 1234, providerAmountCents: 1234, providerStatus: "RECEIVED",
    candidateStatus: "paid", matched: true, blockers: [], checkedAt: "2030-01-01T00:00:00.000Z",
    financialTransitionAllowed: false,
  });
});

test("Asaas reconciliation blocks reference, amount and unsupported status divergences", () => {
  const result = reconcileAsaasPayment({ expected, providerPayment: {
    ...payment, reference: "another-intent", value: 12.35, status: "MYSTERY",
  } });
  assert.equal(result.matched, false);
  assert.deepEqual(result.blockers, ["reference_mismatch", "amount_mismatch", "provider_status_unsupported"]);
  assert.equal(result.financialTransitionAllowed, false);
});

test("Asaas reconciliation rejects fractional cents and invalid evidence", () => {
  const result = reconcileAsaasPayment({ expected, providerPayment: { ...payment, value: 12.345 } });
  assert.deepEqual(result.blockers, ["provider_amount_invalid"]);
  assert.throws(() => reconcileAsaasPayment({ expected: { reference: "", amountCents: 0 }, providerPayment: payment }), /Invalid/);
});

test("Asaas adverse statuses remain explicit reconciliation candidates", () => {
  for (const [status, candidateStatus] of [
    ["OVERDUE", "overdue"], ["REFUNDED", "refunded"],
    ["PARTIALLY_REFUNDED", "partially_refunded"], ["CHARGEBACK_REQUESTED", "chargeback_pending"],
  ]) {
    assert.equal(reconcileAsaasPayment({ expected, providerPayment: { ...payment, status } }).candidateStatus, candidateStatus);
  }
});
