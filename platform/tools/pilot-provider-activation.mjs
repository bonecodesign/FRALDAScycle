import { readFile } from "node:fs/promises";
import { isMainModule } from "../packages/contracts/main-module.js";
import { CREDENTIAL_PATTERN } from "./provider-contract.mjs";

const REQUIRED = Object.freeze({
  payments: Object.freeze([
    "contractApproved", "legalApproved", "privacyApproved", "securityApproved",
    "commercialFeesApproved", "sandboxPassed", "webhooksPassed",
    "reconciliationPassed", "refundsAndDisputesPassed", "rollbackPassed",
  ]),
  logistics: Object.freeze([
    "contractApproved", "legalApproved", "privacyApproved", "securityApproved",
    "commercialFeesApproved", "sandboxPassed", "beloHorizonteCoveragePassed",
    "webhooksPassed", "proofOfDeliveryPassed", "cancellationAndFailurePassed",
    "rollbackPassed",
  ]),
});

const EVIDENCE = /^(approval|contract|test|drill|decision):[A-Za-z0-9._/-]{3,120}$/;

export function validatePilotProviderActivation(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return { valid: false, ready: false, errors: ["manifest must be an object"], blockers: [] };
  if (value.schemaVersion !== 1) errors.push("schemaVersion must equal 1");
  if (value.scope !== "belo-horizonte-pilot") errors.push("scope must equal belo-horizonte-pilot");
  for (const key of ["productionActivationAllowed", "realTransactionsAllowed", "credentialsAllowedInRepository"]) {
    if (typeof value.policy?.[key] !== "boolean") errors.push(`policy.${key} must be boolean`);
  }
  if (value.policy?.credentialsAllowedInRepository !== false) errors.push("credentials in repository must remain forbidden");

  const providers = Array.isArray(value.providers) ? value.providers : [];
  const seen = new Set();
  const blockers = [];
  for (const provider of providers) {
    if (!Object.hasOwn(REQUIRED, provider?.id) || seen.has(provider.id)) {
      errors.push("providers must contain each supported id once");
      continue;
    }
    seen.add(provider.id);
    if ((provider.id === "payments" && provider.candidate !== "asaas") || (provider.id === "logistics" && provider.candidate !== "lalamove")) {
      errors.push(`${provider.id}.candidate does not match the pilot decision`);
    }
    const checks = provider.checks;
    if (!checks || typeof checks !== "object" || Array.isArray(checks)) errors.push(`${provider.id}.checks must be an object`);
    for (const check of REQUIRED[provider.id]) {
      if (typeof checks?.[check] !== "boolean") errors.push(`${provider.id}.${check} must be boolean`);
      else if (!checks[check]) blockers.push(`${provider.id}.${check}`);
    }
    const unexpected = Object.keys(checks ?? {}).filter(key => !REQUIRED[provider.id].includes(key));
    if (unexpected.length) errors.push(`${provider.id}.checks contains unsupported keys`);
    if (!Array.isArray(provider.evidenceReferences) || provider.evidenceReferences.some(reference => !EVIDENCE.test(reference))) {
      errors.push(`${provider.id}.evidenceReferences is invalid`);
    }
    if (REQUIRED[provider.id].every(check => checks?.[check]) && provider.evidenceReferences.length < REQUIRED[provider.id].length) {
      errors.push(`${provider.id} requires at least one evidence reference per approved check`);
    }
  }
  for (const id of Object.keys(REQUIRED)) if (!seen.has(id)) errors.push(`provider ${id} is required`);
  if (CREDENTIAL_PATTERN.test(JSON.stringify(value))) errors.push("manifest appears to contain a credential");

  const ready = errors.length === 0 && blockers.length === 0;
  if (value.status !== (ready ? "ready-for-explicit-activation" : "not-ready")) errors.push("status does not match the check results");
  if ((value.policy?.productionActivationAllowed === true || value.policy?.realTransactionsAllowed === true) && !ready) {
    errors.push("activation policy cannot be enabled while blockers remain");
  }
  return Object.freeze({ valid: errors.length === 0, ready, errors: Object.freeze(errors), blockers: Object.freeze(blockers) });
}

export async function inspectPilotProviderActivation(path = new URL("../config/pilot-provider-activation.v1.json", import.meta.url)) {
  const manifest = JSON.parse(await readFile(path, "utf8"));
  return { manifest, ...validatePilotProviderActivation(manifest) };
}

if (isMainModule(import.meta.url)) {
  try {
    const report = await inspectPilotProviderActivation(process.argv[2]);
    console.log(JSON.stringify({ valid: report.valid, ready: report.ready, blockers: report.blockers, errors: report.errors }, null, 2));
    if (!report.valid) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ valid: false, ready: false, errors: [error.message] }, null, 2));
    process.exitCode = 1;
  }
}
