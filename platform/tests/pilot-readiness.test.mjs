import assert from "node:assert/strict";
import test from "node:test";
import { inspectPilotReadinessManifest, validatePilotReadinessManifest } from "../tools/pilot-readiness.mjs";

test("internal pilot plan is valid without external integrations or real data", async () => {
  const report = await inspectPilotReadinessManifest();
  assert.equal(report.valid, true, report.errors.join("\n"));
  assert.equal(report.manifest.status, "internal-dry-run");
  assert.deepEqual(report.manifest.policy, {
    externalIntegrationsAllowed: false,
    realPersonalDataAllowed: false,
    realTransactionsAllowed: false,
    publicAccessAllowed: false,
  });
  assert.deepEqual(report.manifest.gates.map(({ id }) => id), [
    "product-rules",
    "identity-access",
    "marketplace-journey",
    "safety-privacy",
    "accessibility-devices",
    "support-incidents",
    "pilot-exit",
  ]);
});

test("pilot validator rejects unsafe policy and duplicated gates", () => {
  const report = validatePilotReadinessManifest({
    schemaVersion: 1,
    status: "internal-dry-run",
    policy: {
      externalIntegrationsAllowed: true,
      realPersonalDataAllowed: false,
      realTransactionsAllowed: false,
      publicAccessAllowed: false,
    },
    gates: [
      { id: "product-rules", owner: "product", evidence: ["approved-rules"] },
      { id: "product-rules", owner: "product", evidence: ["catalog-scope"] },
    ],
  });
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /externalIntegrationsAllowed/);
  assert.match(report.errors.join("\n"), /duplicated/);
});

test("pilot validator requires accountable owners and evidence", () => {
  const report = validatePilotReadinessManifest({
    schemaVersion: 1,
    status: "internal-dry-run",
    policy: {
      externalIntegrationsAllowed: false,
      realPersonalDataAllowed: false,
      realTransactionsAllowed: false,
      publicAccessAllowed: false,
    },
    gates: [{ id: "pilot", owner: "unknown", evidence: [] }],
  });
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /owner/);
  assert.match(report.errors.join("\n"), /evidence/);
});
