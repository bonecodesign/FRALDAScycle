import { readFile } from "node:fs/promises";

const IDS = Object.freeze(["notifications", "media", "geocoding", "payments", "logistics", "distributedRateLimit", "telemetry", "externalSecrets"]);
const CATEGORIES = Object.freeze(["technical", "security", "privacy", "commercial", "legal", "operations"]);
const REQUIRED_GATES = Object.freeze(["marketplace-compatible", "lgpd-dpa-approved", "https-and-encryption", "sandbox-or-equivalent", "data-export-and-deletion", "bounded-cost", "exit-plan", "no-prototype-change"]);
const QUESTION = /^[A-Z]{3}-\d{2}: .{20,}$/;
const SECRET = /(-----BEGIN [A-Z ]+PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}|sk_(live|test)_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16})/;

export function validateProviderDueDiligence(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return Object.freeze({ valid: false, errors: Object.freeze(["diligence must be an object"]) });
  if (value.schemaVersion !== 1) errors.push("schemaVersion must equal 1");
  if (value.status !== "prepared-not-sent") errors.push("status must equal prepared-not-sent");
  for (const key of ["externalContactPerformed", "commercialApprovalGranted", "legalApprovalGranted", "securityApprovalGranted", "privacyApprovalGranted", "contracted", "provisioned", "credentialsStored"]) {
    if (value.policy?.[key] !== false) errors.push("policy." + key + " must be false");
  }
  if (CATEGORIES.some((key) => !Number.isInteger(value.scoreWeights?.[key]) || value.scoreWeights[key] <= 0)) errors.push("scoreWeights must cover every category");
  if (Object.values(value.scoreWeights ?? {}).reduce((sum, weight) => sum + weight, 0) !== 100) errors.push("scoreWeights must total 100");
  if (value.approval?.minimumScore !== 80 || value.approval?.allGatesRequired !== true) errors.push("approval threshold is invalid");
  if (JSON.stringify(value.approval?.gates) !== JSON.stringify(REQUIRED_GATES)) errors.push("required gates are invalid");
  const providers = Array.isArray(value.providers) ? value.providers : [];
  if (providers.length !== IDS.length) errors.push("providers must cover exactly eight capabilities");
  const seenIds = new Set();
  const seenQuestions = new Set();
  for (const [index, provider] of providers.entries()) {
    const at = "providers[" + index + "]";
    if (!IDS.includes(provider?.id)) errors.push(at + ".id is unknown");
    else if (seenIds.has(provider.id)) errors.push(at + ".id is duplicated");
    else seenIds.add(provider.id);
    if (provider?.state !== "not-contacted") errors.push(at + ".state must equal not-contacted");
    if (typeof provider?.candidate !== "string" || !/^[a-z][a-z0-9-]*$/.test(provider.candidate)) errors.push(at + ".candidate is invalid");
    if (!Array.isArray(provider?.questions) || provider.questions.length < 5) errors.push(at + ".questions are incomplete");
    for (const question of provider?.questions ?? []) {
      if (!QUESTION.test(question)) errors.push(at + ".question is invalid");
      const id = question.split(":")[0];
      if (seenQuestions.has(id)) errors.push("question " + id + " is duplicated");
      seenQuestions.add(id);
    }
  }
  for (const id of IDS) if (!seenIds.has(id)) errors.push("missing capability " + id);
  if (value.evidencePolicy?.answersStoredInRepository !== false) errors.push("answersStoredInRepository must be false");
  if (!Array.isArray(value.evidencePolicy?.forbidden) || !value.evidencePolicy.forbidden.includes("credential")) errors.push("credential evidence must be forbidden");
  if (SECRET.test(JSON.stringify(value))) errors.push("diligence appears to contain a credential");
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export async function inspectProviderDueDiligence(path = new URL("../config/provider-due-diligence.v1.json", import.meta.url)) {
  const diligence = JSON.parse(await readFile(path, "utf8"));
  return { diligence, ...validateProviderDueDiligence(diligence) };
}

const invokedPath = process.argv[1]?.replaceAll("\\", "/");
if (invokedPath && import.meta.url === "file://" + invokedPath) {
  try {
    const report = await inspectProviderDueDiligence(process.argv[2]);
    console.log(JSON.stringify({ valid: report.valid, errors: report.errors }, null, 2));
    if (!report.valid) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ valid: false, errors: [error.message] }, null, 2));
    process.exitCode = 1;
  }
}
