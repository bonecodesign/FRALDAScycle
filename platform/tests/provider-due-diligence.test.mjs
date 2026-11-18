import assert from "node:assert/strict";
import test from "node:test";
import { inspectProviderDueDiligence, validateProviderDueDiligence } from "../tools/provider-due-diligence.mjs";

test("provider diligence is complete, unsent and contains no approvals or credentials", async () => {
  const report = await inspectProviderDueDiligence();
  assert.equal(report.valid, true, report.errors.join("\n"));
  assert.equal(report.diligence.providers.length, 8);
  assert.equal(report.diligence.providers.every(({ state }) => state === "not-contacted"), true);
  assert.equal(report.diligence.providers.flatMap(({ questions }) => questions).length, 44);
  assert.equal(Object.values(report.diligence.scoreWeights).reduce((sum, value) => sum + value, 0), 100);
});

test("provider diligence rejects contact, approval and unsafe evidence storage", () => {
  const unsafe = {
    schemaVersion: 1,
    status: "prepared-not-sent",
    policy: {
      externalContactPerformed: true,
      commercialApprovalGranted: true,
      legalApprovalGranted: false,
      securityApprovalGranted: false,
      privacyApprovalGranted: false,
      contracted: false,
      provisioned: false,
      credentialsStored: false
    },
    scoreWeights: { technical: 25, security: 20, privacy: 15, commercial: 15, legal: 10, operations: 15 },
    approval: { minimumScore: 80, allGatesRequired: true, gates: [] },
    providers: [],
    evidencePolicy: { forbidden: [], answersStoredInRepository: true }
  };
  const report = validateProviderDueDiligence(unsafe);
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /externalContactPerformed/);
  assert.match(report.errors.join("\n"), /commercialApprovalGranted/);
  assert.match(report.errors.join("\n"), /answersStoredInRepository/);
});

test("provider diligence rejects duplicate or incomplete questionnaires", () => {
  const provider = { id: "payments", candidate: "asaas", state: "contacted", questions: ["PAY-01: short"] };
  const report = validateProviderDueDiligence({
    schemaVersion: 1,
    status: "prepared-not-sent",
    policy: {
      externalContactPerformed: false,
      commercialApprovalGranted: false,
      legalApprovalGranted: false,
      securityApprovalGranted: false,
      privacyApprovalGranted: false,
      contracted: false,
      provisioned: false,
      credentialsStored: false
    },
    scoreWeights: { technical: 25, security: 20, privacy: 15, commercial: 15, legal: 10, operations: 15 },
    approval: {
      minimumScore: 80,
      allGatesRequired: true,
      gates: ["marketplace-compatible", "lgpd-dpa-approved", "https-and-encryption", "sandbox-or-equivalent", "data-export-and-deletion", "bounded-cost", "exit-plan", "no-prototype-change"]
    },
    providers: Array.from({ length: 8 }, () => provider),
    evidencePolicy: { forbidden: ["credential"], answersStoredInRepository: false }
  });
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /not-contacted/);
  assert.match(report.errors.join("\n"), /incomplete/);
  assert.match(report.errors.join("\n"), /duplicated/);
});

test("FC-310: vendor questionnaire cannot omit image processing and human review proof", async () => {
  const { diligence } = await inspectProviderDueDiligence();
  const media = diligence.providers.find(provider => provider.id === "media");
  assert.equal(media.questions.length, 9);
  for (const number of [6,7,8,9]) {
    const code = "MED-" + String(number).padStart(2, "0");
    assert.ok(media.questions.some(question => question.startsWith(code + ": ")));
    const changed = structuredClone(diligence);
    const entry = changed.providers.find(provider => provider.id === "media");
    entry.questions = entry.questions.filter(question => !question.startsWith(code + ": "));
    const result = validateProviderDueDiligence(changed);
    assert.equal(result.valid, false, code);
    assert.match(result.errors.join(" "), new RegExp("missing media requirement " + code));
  }
  assert.equal(diligence.policy.externalContactPerformed, false);
  assert.equal(diligence.policy.contracted, false);
  assert.equal(diligence.policy.credentialsStored, false);
});
