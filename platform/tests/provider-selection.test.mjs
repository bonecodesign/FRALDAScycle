import assert from "node:assert/strict";
import test from "node:test";
import { inspectProviderSelection, validateProviderSelection } from "../tools/provider-selection.mjs";

test("provider selection covers all capabilities without contracting or credentials", async () => {
  const report = await inspectProviderSelection();
  assert.equal(report.valid, true, report.errors.join("\n"));
  assert.equal(report.selection.status, "research-only");
  assert.deepEqual(report.selection.policy, {
    contracted: false,
    provisioned: false,
    credentialsStored: false,
    externalPublicationPerformed: false,
  });
  assert.equal(report.selection.selection.length, 8);
});

test("provider selection rejects unsafe state and credential-shaped content", () => {
  const report = validateProviderSelection({
    schemaVersion: 1,
    status: "contracted",
    policy: { contracted: true, provisioned: false, credentialsStored: false, externalPublicationPerformed: false },
    selection: [{ leaked: "sk_live_12345678901234567890" }],
  });
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /research-only/);
  assert.match(report.errors.join("\n"), /contracted/);
  assert.match(report.errors.join("\n"), /credential/);
});

test("provider selection rejects missing alternatives and non-HTTPS evidence", () => {
  const invalid = {
    id: "payments",
    recommended: "asaas",
    alternative: "asaas",
    reason: "x".repeat(50),
    costModel: "x".repeat(40),
    blockingChecks: ["sandbox", "refunds", "webhooks"],
    evidence: ["http://example.com", "not-a-url"],
  };
  const report = validateProviderSelection({
    schemaVersion: 1,
    status: "research-only",
    policy: { contracted: false, provisioned: false, credentialsStored: false, externalPublicationPerformed: false },
    selection: Array.from({ length: 8 }, () => invalid),
  });
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /alternative/);
  assert.match(report.errors.join("\n"), /HTTPS/);
  assert.match(report.errors.join("\n"), /duplicated/);
});
