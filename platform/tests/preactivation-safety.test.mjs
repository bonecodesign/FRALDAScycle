import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  inspectPreactivationSafety,
  PREACTIVATION_DISABLED_FLAGS,
  PREACTIVATION_UNCONFIRMED_APPROVALS,
} from "../tools/preactivation-safety.mjs";

test("preactivation gate accepts an inert environment", () => {
  const report = inspectPreactivationSafety({
    NODE_ENV: "development",
    ASAAS_ENVIRONMENT: "sandbox",
    LALAMOVE_ENVIRONMENT: "sandbox",
  });
  assert.equal(report.safe, true);
  assert.equal(report.mode, "preactivation");
  assert.equal(report.checkedFlags, 19);
  assert.deepEqual(report.blockers, []);
});

test("every protected capability fails closed when enabled", () => {
  for (const flag of PREACTIVATION_DISABLED_FLAGS) {
    const report = inspectPreactivationSafety({ [flag]: "true" });
    assert.equal(report.safe, false, flag);
    assert.deepEqual(report.enabledFlags, [flag]);
    assert.match(report.blockers[0], new RegExp(flag));
  }
});

test("provider production selection is blocked even without an enabled feature", () => {
  const report = inspectPreactivationSafety({
    ASAAS_ENVIRONMENT: "production",
    LALAMOVE_ENVIRONMENT: "production",
  });
  assert.equal(report.safe, false);
  assert.deepEqual(report.productionProviders, ["ASAAS_ENVIRONMENT", "LALAMOVE_ENVIRONMENT"]);
});

test("unconfirmed approval claims fail closed even without enabling a feature", () => {
  for (const flag of PREACTIVATION_UNCONFIRMED_APPROVALS) {
    const report = inspectPreactivationSafety({ [flag]: "true" });
    assert.equal(report.safe, false, flag);
    assert.deepEqual(report.claimedApprovals, [flag]);
  }
});

test("truthy-looking values do not accidentally count as an activation", () => {
  const report = inspectPreactivationSafety({ ASAAS_ENABLED: "TRUE", PILOT_BH_ENABLED: "1" });
  assert.equal(report.safe, true);
});

test("environment template exposes every protected flag as disabled", async () => {
  const source = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  const template = Object.fromEntries(source.split(/\r?\n/).filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)]; }));
  for (const flag of PREACTIVATION_DISABLED_FLAGS) {
    assert.equal(template[flag], "false", `${flag} must be explicit and disabled in .env.example`);
  }
  for (const flag of PREACTIVATION_UNCONFIRMED_APPROVALS) {
    assert.equal(template[flag], "false", `${flag} must not claim approval in .env.example`);
  }
  assert.equal(inspectPreactivationSafety(template).safe, true);
});
