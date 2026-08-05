import { readFile } from "node:fs/promises";

const ID = /^[a-z][A-Za-z0-9]*$/;
const ENV_KEY = /^[A-Z][A-Z0-9_]*$/;
const CHECK = /^[a-z0-9][a-z0-9-]*$/;
const SECRET_VALUE = /(-----BEGIN [A-Z ]+PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}|sk_(live|test)_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16})/;

export function validateProviderReadinessManifest(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return { valid: false, errors: ["manifest must be an object"] };
  if (value.schemaVersion !== 1) errors.push("schemaVersion must equal 1");
  if (value.status !== "pre-contract") errors.push("status must equal pre-contract");
  for (const key of ["credentialsAllowed", "paidProvisioningAllowed", "externalPublicationAllowed"]) {
    if (value.policy?.[key] !== false) errors.push("policy." + key + " must be false");
  }
  if (!Array.isArray(value.providers) || value.providers.length === 0) {
    errors.push("providers must be a non-empty array");
  } else {
    const ids = new Set();
    for (const [index, provider] of value.providers.entries()) {
      const at = "providers[" + index + "]";
      if (!ID.test(provider?.id ?? "")) errors.push(at + ".id is invalid");
      else if (ids.has(provider.id)) errors.push(at + ".id is duplicated");
      else ids.add(provider.id);
      if (typeof provider?.capability !== "string" || !CHECK.test(provider.capability)) errors.push(at + ".capability is invalid");
      if (!Array.isArray(provider?.requiredEnvironment) || provider.requiredEnvironment.length === 0 || provider.requiredEnvironment.some((key) => !ENV_KEY.test(key))) {
        errors.push(at + ".requiredEnvironment is invalid");
      }
      if (!Array.isArray(provider?.contractChecks) || provider.contractChecks.length === 0 || provider.contractChecks.some((check) => !CHECK.test(check))) {
        errors.push(at + ".contractChecks is invalid");
      }
    }
  }
  if (SECRET_VALUE.test(JSON.stringify(value))) errors.push("manifest appears to contain a credential");
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export async function inspectProviderReadinessManifest(path = new URL("../config/provider-readiness.v1.json", import.meta.url)) {
  const manifest = JSON.parse(await readFile(path, "utf8"));
  return { manifest, ...validateProviderReadinessManifest(manifest) };
}

const invokedPath = process.argv[1]?.replaceAll("\\", "/");
if (invokedPath && import.meta.url === "file://" + invokedPath) {
  try {
    const report = await inspectProviderReadinessManifest(process.argv[2]);
    console.log(JSON.stringify({ valid: report.valid, errors: report.errors }, null, 2));
    if (!report.valid) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ valid: false, errors: [error.message] }, null, 2));
    process.exitCode = 1;
  }
}
