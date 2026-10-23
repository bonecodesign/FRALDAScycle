import assert from "node:assert/strict";
import test from "node:test";
import { assessLoadTestReadiness } from "../packages/contracts/load-test-readiness.js";

const passing = {
  environment: "isolated-synthetic", syntheticDataOnly: true,
  stages: [
    { concurrentUsers: 100, p95Ms: 260, p99Ms: 700, internalErrorRatePercent: 0.2 },
    { concurrentUsers: 300, p95Ms: 480, p99Ms: 1400, internalErrorRatePercent: 0.8 },
  ],
  controlledPeak: { concurrentUsers: 360 },
  integrity: { lostRecords: 0, corruptedRecords: 0, duplicateCommitments: 0 },
  recoveredAfterPeak: true,
};

test("accepts the complete synthetic load contract without authorizing launch", () => {
  assert.deepEqual(assessLoadTestReadiness(passing), {
    status: "synthetic-pass", launchAuthorized: false, blockers: [], requiredStages: [100, 300],
    notice: "Carga sintética atende ao contrato; homologação na infraestrutura escolhida continua obrigatória.",
  });
});

test("requires both planned concurrency stages and a controlled peak", () => {
  const result = assessLoadTestReadiness({ ...passing, stages: passing.stages.slice(0, 1), controlledPeak: { concurrentUsers: 299 } });
  assert.equal(result.status, "blocked");
  assert.ok(result.blockers.includes("stage_300_required"));
  assert.ok(result.blockers.includes("controlled_peak_required"));
});

test("blocks latency, errors, integrity failures and absent recovery", () => {
  const result = assessLoadTestReadiness({
    ...passing,
    stages: passing.stages.map(item => item.concurrentUsers === 300 ? { ...item, p95Ms: 501, p99Ms: 1501, internalErrorRatePercent: 1 } : item),
    integrity: { lostRecords: 1, corruptedRecords: 2, duplicateCommitments: 1 },
    recoveredAfterPeak: false,
  });
  assert.equal(result.launchAuthorized, false);
  for (const blocker of ["stage_300_p95_exceeded", "stage_300_p99_exceeded", "stage_300_error_rate_exceeded", "record_loss_detected", "record_corruption_detected", "duplicate_commitments_detected", "post_peak_recovery_required"]) {
    assert.ok(result.blockers.includes(blocker), blocker);
  }
});

test("rejects real or unspecified data in the preactivation evaluator", () => {
  assert.ok(assessLoadTestReadiness({ ...passing, syntheticDataOnly: false }).blockers.includes("isolated_synthetic_environment_required"));
  assert.ok(assessLoadTestReadiness({ ...passing, environment: "production" }).blockers.includes("isolated_synthetic_environment_required"));
});
