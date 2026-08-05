import { readFile } from "node:fs/promises";

const EXPECTED_IDS = Object.freeze([
  "notifications",
  "media",
  "geocoding",
  "payments",
  "logistics",
  "distributedRateLimit",
  "telemetry",
  "externalSecrets",
]);
const SLUG = /^[a-z][a-z0-9-]*$/;
const CHECK = /^[a-z0-9][a-z0-9-]*$/;
const CREDENTIAL = /(-----BEGIN [A-Z ]+PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}|sk_(live|test)_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16})/;

export function validateProviderSelection(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze({ valid: false, errors: Object.freeze(["selection must be an object"]) });
  }
  if (value.schemaVersion !== 1) errors.push("schemaVersion must equal 1");
  if (value.status !== "research-only") errors.push("status must equal research-only");
  for (const key of ["contracted", "provisioned", "credentialsStored", "externalPublicationPerformed"]) {
    if (value.policy?.[key] !== false) errors.push("policy." + key + " must be false");
  }
  const entries = Array.isArray(value.selection) ? value.selection : [];
  if (entries.length !== EXPECTED_IDS.length) errors.push("selection must cover exactly eight capabilities");
  const ids = new Set();
  for (const [index, entry] of entries.entries()) {
    const at = "selection[" + index + "]";
    if (!EXPECTED_IDS.includes(entry?.id)) errors.push(at + ".id is unknown");
    else if (ids.has(entry.id)) errors.push(at + ".id is duplicated");
    else ids.add(entry.id);
    if (!SLUG.test(entry?.recommended ?? "")) errors.push(at + ".recommended is invalid");
    if (!SLUG.test(entry?.alternative ?? "") || entry.alternative === entry.recommended) errors.push(at + ".alternative is invalid");
    if (typeof entry?.reason !== "string" || entry.reason.length < 40) errors.push(at + ".reason is incomplete");
    if (typeof entry?.costModel !== "string" || entry.costModel.length < 30) errors.push(at + ".costModel is incomplete");
    if (!Array.isArray(entry?.blockingChecks) || entry.blockingChecks.length < 3 || entry.blockingChecks.some((check) => !CHECK.test(check))) {
      errors.push(at + ".blockingChecks is invalid");
    }
    if (!Array.isArray(entry?.evidence) || entry.evidence.length < 2 || entry.evidence.some((url) => {
      try { return new URL(url).protocol !== "https:"; } catch { return true; }
    })) errors.push(at + ".evidence must contain HTTPS sources");
  }
  for (const id of EXPECTED_IDS) if (!ids.has(id)) errors.push("missing capability " + id);
  if (CREDENTIAL.test(JSON.stringify(value))) errors.push("selection appears to contain a credential");
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export async function inspectProviderSelection(path = new URL("../config/provider-selection.v1.json", import.meta.url)) {
  const selection = JSON.parse(await readFile(path, "utf8"));
  return { selection, ...validateProviderSelection(selection) };
}

const invokedPath = process.argv[1]?.replaceAll("\\", "/");
if (invokedPath && import.meta.url === "file://" + invokedPath) {
  try {
    const report = await inspectProviderSelection(process.argv[2]);
    console.log(JSON.stringify({ valid: report.valid, errors: report.errors }, null, 2));
    if (!report.valid) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ valid: false, errors: [error.message] }, null, 2));
    process.exitCode = 1;
  }
}
