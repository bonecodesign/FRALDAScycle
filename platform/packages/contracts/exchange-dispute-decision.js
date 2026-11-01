const STAGES = Object.freeze({ support_analysis: 2, finance_approval: 3, founder_authorization: 5 });
const OUTCOMES = new Set(["release", "refund_full", "refund_with_proven_fee"]);

export function exchangeDisputeDecision({ stage, actorAccessLevel, outcome, note }) {
  const normalizedNote = String(note ?? "").trim().replace(/\s+/g, " ");
  if (STAGES[stage] !== actorAccessLevel || !OUTCOMES.has(outcome)
      || normalizedNote.length < 10 || normalizedNote.length > 1000) {
    throw new Error("invalid_exchange_dispute_decision");
  }
  return Object.freeze({ stage, requiredAccessLevel: STAGES[stage], outcome, note: normalizedNote });
}

export const EXCHANGE_DISPUTE_STAGES = Object.freeze(Object.keys(STAGES));
