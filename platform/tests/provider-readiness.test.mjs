import assert from "node:assert/strict";
import test from "node:test";
import { inspectProviderReadinessManifest, validateProviderReadinessManifest, REQUIRED_MEDIA_CHECKS } from "../tools/provider-readiness.mjs";

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

test("FC-310: media provider requires storage, processing, privacy and human review contract gates", async () => {
  const { manifest } = await inspectProviderReadinessManifest();
  const media = manifest.providers.find(provider => provider.id === "media");
  assert.ok(media);
  for (const check of REQUIRED_MEDIA_CHECKS) {
    assert.ok(media.contractChecks.includes(check), check);
    const changed = structuredClone(manifest);
    changed.providers.find(provider => provider.id === "media").contractChecks =
      changed.providers.find(provider => provider.id === "media").contractChecks.filter(item => item !== check);
    const result = validateProviderReadinessManifest(changed);
    assert.equal(result.valid, false, check);
    assert.match(result.errors.join(" "), new RegExp("missing media gate: " + check));
  }
  for (const key of ["MEDIA_PROVIDER_URL", "MEDIA_PROVIDER_SECRET"]) {
    const changed = structuredClone(manifest);
    const entry = changed.providers.find(provider => provider.id === "media");
    entry.requiredEnvironment = entry.requiredEnvironment.filter(item => item !== key);
    const result = validateProviderReadinessManifest(changed);
    assert.equal(result.valid, false, key);
    assert.ok(result.errors.some(error => error.includes(key)));
  }
  const removed = structuredClone(manifest);
  removed.providers = removed.providers.filter(provider => provider.id !== "media");
  assert.match(validateProviderReadinessManifest(removed).errors.join(" "), /media capability/);
});
