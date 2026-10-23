import { verifyIncidentDrillEvidence } from "./incident-drill-evidence.js";

const REQUIRED_ROLES = Object.freeze(["triage", "technical", "substitute"]);
const OUTCOMES = new Set(["passed", "repeat", "no-go"]);
const REF = /^[a-z0-9][a-z0-9._:-]{2,79}$/i;

function validPastTimestamp(value, now) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) && parsed <= now;
}

export function assessIncidentDrillSignoff(input, clock = Date.now) {
  const blockers = [];
  const now = clock();
  if (!verifyIncidentDrillEvidence(input?.evidence)) blockers.push("verified_technical_evidence_required");
  if (input?.humanObserved !== true) blockers.push("human_observation_required");

  const acceptances = Array.isArray(input?.roleAcceptances) ? input.roleAcceptances : [];
  const acceptedRefs = new Set();
  for (const role of REQUIRED_ROLES) {
    const matching = acceptances.filter(item => item?.role === role);
    if (matching.length !== 1 || matching[0]?.accepted !== true || !REF.test(String(matching[0]?.participantRef ?? "")) ||
        !validPastTimestamp(matching[0]?.acceptedAt, now)) {
      blockers.push(`${role}_acceptance_required`);
    } else {
      acceptedRefs.add(matching[0].participantRef);
    }
  }
  if (acceptedRefs.size !== REQUIRED_ROLES.length) blockers.push("distinct_role_holders_required");

  const observerRef = String(input?.observation?.observerRef ?? "");
  if (!REF.test(observerRef) || acceptedRefs.has(observerRef) || !validPastTimestamp(input?.observation?.observedAt, now)) {
    blockers.push("independent_observer_required");
  }

  const outcome = String(input?.decision?.outcome ?? "");
  if (!OUTCOMES.has(outcome) || !REF.test(String(input?.decision?.decidedByRef ?? "")) ||
      !validPastTimestamp(input?.decision?.decidedAt, now) || String(input?.decision?.rationale ?? "").trim().length < 20) {
    blockers.push("formal_decision_required");
  }
  const unresolved = (Array.isArray(input?.findings) ? input.findings : [])
    .filter(item => ["high", "critical"].includes(item?.severity) && item?.status !== "resolved");
  if (outcome === "passed" && unresolved.length) blockers.push("high_risk_findings_must_be_resolved");

  const uniqueBlockers = Object.freeze([...new Set(blockers)]);
  return Object.freeze({
    status: uniqueBlockers.length === 0 ? "complete" : "pending",
    launchAuthorized: false,
    blockers: uniqueBlockers,
    notice: uniqueBlockers.length === 0
      ? "Exercício humano registrado; a autorização de lançamento permanece em portão separado."
      : "Exercício humano ainda não comprovado.",
  });
}
