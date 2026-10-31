import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectPreactivationSafety,
  PREACTIVATION_DISABLED_FLAGS,
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

test("truthy-looking values do not accidentally count as an activation", () => {
  const report = inspectPreactivationSafety({ ASAAS_ENABLED: "TRUE", PILOT_BH_ENABLED: "1" });
  assert.equal(report.safe, true);
});
