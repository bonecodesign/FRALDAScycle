import assert from "node:assert/strict";
import test from "node:test";
import { inspectProviderReadinessManifest, validateProviderReadinessManifest } from "../tools/provider-readiness.mjs";

test("versioned provider plan is valid without credentials or paid provisioning", async () => {
  const report = await inspectProviderReadinessManifest();
  assert.equal(report.valid, true, report.errors.join("\n"));
  assert.equal(report.manifest.schemaVersion, 1);
  assert.equal(report.manifest.policy.credentialsAllowed, false);
  assert.equal(report.manifest.policy.paidProvisioningAllowed, false);
  assert.equal(report.manifest.policy.externalPublicationAllowed, false);
  assert.deepEqual(
    report.manifest.providers.map(({ id }) => id),
    ["notifications", "media", "geocoding", "payments", "logistics", "distributedRateLimit", "telemetry", "externalSecrets"],
  );
});

test("provider plan validator rejects unsafe policy and credential-shaped values", () => {
  const unsafe = {
    schemaVersion: 1,
    status: "pre-contract",
    policy: { credentialsAllowed: true, paidProvisioningAllowed: false, externalPublicationAllowed: false },
    providers: [{
      id: "payments",
      capability: "payments",
      requiredEnvironment: ["PAYMENT_PROVIDER_SECRET"],
      contractChecks: ["sk-live-12345678901234567890"],
      leakedValue: "sk_live_12345678901234567890",
    }],
  };
  const report = validateProviderReadinessManifest(unsafe);
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /credentialsAllowed/);
  assert.match(report.errors.join("\n"), /credential/);
});

test("provider plan validator rejects duplicate providers and malformed environment keys", () => {
  const report = validateProviderReadinessManifest({
    schemaVersion: 1,
    status: "pre-contract",
    policy: { credentialsAllowed: false, paidProvisioningAllowed: false, externalPublicationAllowed: false },
    providers: [
      { id: "media", capability: "media", requiredEnvironment: ["MEDIA_SECRET"], contractChecks: ["https"] },
      { id: "media", capability: "media", requiredEnvironment: ["not-secret"], contractChecks: ["https"] },
    ],
  });
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /duplicated/);
  assert.match(report.errors.join("\n"), /requiredEnvironment/);
});
