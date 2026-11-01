const ACTIONS = new Set(["confirm_with_provider", "retry_same_idempotency", "manual_refund"]);

function text(value, minimum, maximum) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  if (normalized.length < minimum || normalized.length > maximum) throw new Error("invalid_exchange_reconciliation_decision");
  return normalized;
}

export function exchangeReconciliationProposal({ actorAccessLevel, action, evidenceReference, note }) {
  if (actorAccessLevel !== 3 || !ACTIONS.has(action)) throw new Error("invalid_exchange_reconciliation_decision");
  return Object.freeze({ action, evidenceReference: text(evidenceReference, 3, 200), note: text(note, 10, 1000) });
}

export function exchangeReconciliationAuthorization({ actorAccessLevel, note }) {
  if (!Number.isInteger(actorAccessLevel) || actorAccessLevel < 4 || actorAccessLevel > 5) throw new Error("invalid_exchange_reconciliation_decision");
  return Object.freeze({ actorAccessLevel, note: text(note, 10, 1000) });
}
