import assert from "node:assert/strict";
import test from "node:test";
import { inspectPilotProviderActivation, validatePilotProviderActivation } from "../tools/pilot-provider-activation.mjs";

test("Asaas and Lalamove remain explicitly blocked before external homologation", async () => {
  const report = await inspectPilotProviderActivation();
  assert.equal(report.valid, true, report.errors.join("\n"));
  assert.equal(report.ready, false);
  assert.equal(report.manifest.policy.productionActivationAllowed, false);
  assert.equal(report.manifest.policy.realTransactionsAllowed, false);
  assert.ok(report.blockers.includes("payments.contractApproved"));
  assert.ok(report.blockers.includes("logistics.beloHorizonteCoveragePassed"));
});

test("activation cannot be claimed while a required check is pending", async () => {
  const current = (await inspectPilotProviderActivation()).manifest;
  const unsafe = structuredClone(current);
  unsafe.policy.productionActivationAllowed = true;
  unsafe.policy.realTransactionsAllowed = true;
  const report = validatePilotProviderActivation(unsafe);
  assert.equal(report.valid, false);
  assert.equal(report.ready, false);
  assert.match(report.errors.join("\n"), /cannot be enabled/);
});

test("a fully evidenced manifest reaches only the explicit activation gate", async () => {
  const ready = structuredClone((await inspectPilotProviderActivation()).manifest);
  for (const provider of ready.providers) {
    for (const key of Object.keys(provider.checks)) provider.checks[key] = true;
    provider.evidenceReferences = Object.keys(provider.checks).map((key, index) => `test:${provider.id}/${index + 1}-${key}`);
  }
  ready.status = "ready-for-explicit-activation";
  const report = validatePilotProviderActivation(ready);
  assert.equal(report.valid, true, report.errors.join("\n"));
  assert.equal(report.ready, true);
  assert.equal(ready.policy.productionActivationAllowed, false);
  assert.equal(ready.policy.realTransactionsAllowed, false);
});

test("wrong candidates, unsupported checks and credential-shaped evidence are rejected", async () => {
  const unsafe = structuredClone((await inspectPilotProviderActivation()).manifest);
  unsafe.providers[0].candidate = "other";
  unsafe.providers[0].checks.bypass = true;
  unsafe.providers[0].evidenceReferences = ["sk_live_12345678901234567890"];
  const report = validatePilotProviderActivation(unsafe);
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /pilot decision/);
  assert.match(report.errors.join("\n"), /unsupported keys/);
  assert.match(report.errors.join("\n"), /evidenceReferences|credential/);
});
