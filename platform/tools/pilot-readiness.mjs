import { readFile } from "node:fs/promises";

const ID = /^[a-z][a-z0-9-]*$/;
const OWNERS = new Set(["product", "engineering", "security", "quality", "operations", "management"]);
const REQUIRED_POLICY = [
  "externalIntegrationsAllowed",
  "realPersonalDataAllowed",
  "realTransactionsAllowed",
  "publicAccessAllowed",
];

export function validatePilotReadinessManifest(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze({ valid: false, errors: Object.freeze(["manifest must be an object"]) });
  }
  if (value.schemaVersion !== 1) errors.push("schemaVersion must equal 1");
  if (value.status !== "internal-dry-run") errors.push("status must equal internal-dry-run");
  for (const key of REQUIRED_POLICY) {
    if (value.policy?.[key] !== false) errors.push("policy." + key + " must be false");
  }
  if (!Array.isArray(value.gates) || value.gates.length === 0) {
    errors.push("gates must be a non-empty array");
  } else {
    const ids = new Set();
    for (const [index, gate] of value.gates.entries()) {
      const at = "gates[" + index + "]";
      if (!ID.test(gate?.id ?? "")) errors.push(at + ".id is invalid");
      else if (ids.has(gate.id)) errors.push(at + ".id is duplicated");
      else ids.add(gate.id);
      if (!OWNERS.has(gate?.owner)) errors.push(at + ".owner is invalid");
      if (!Array.isArray(gate?.evidence) || gate.evidence.length === 0 || gate.evidence.some((item) => !ID.test(item))) {
        errors.push(at + ".evidence is invalid");
      }
    }
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export async function inspectPilotReadinessManifest(path = new URL("../config/pilot-readiness.v1.json", import.meta.url)) {
  const manifest = JSON.parse(await readFile(path, "utf8"));
  return { manifest, ...validatePilotReadinessManifest(manifest) };
}

const invokedPath = process.argv[1]?.replaceAll("\\", "/");
if (invokedPath && import.meta.url === "file://" + invokedPath) {
  try {
    const report = await inspectPilotReadinessManifest(process.argv[2]);
    console.log(JSON.stringify({ valid: report.valid, errors: report.errors }, null, 2));
    if (!report.valid) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ valid: false, errors: [error.message] }, null, 2));
    process.exitCode = 1;
  }
}
