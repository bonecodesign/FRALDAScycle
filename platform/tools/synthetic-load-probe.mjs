import { performance } from "node:perf_hooks";
import { assessLoadTestReadiness } from "../packages/contracts/load-test-readiness.js";

function percentile(values, rank) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * rank) - 1)] ?? 0;
}

async function executeStage(concurrentUsers, operation) {
  const samples = await Promise.all(Array.from({ length: concurrentUsers }, async (_, index) => {
    const started = performance.now();
    try {
      await operation({ virtualUser: index + 1, concurrentUsers });
      return { durationMs: performance.now() - started, failed: false };
    } catch {
      return { durationMs: performance.now() - started, failed: true };
    }
  }));
  const durations = samples.map(item => item.durationMs);
  const failures = samples.filter(item => item.failed).length;
  return Object.freeze({
    concurrentUsers,
    p95Ms: percentile(durations, 0.95),
    p99Ms: percentile(durations, 0.99),
    internalErrorRatePercent: failures / concurrentUsers * 100,
  });
}

export async function runSyntheticLoadProbe({
  confirmed, operation, integrityProbe, recoveryProbe, peakUsers = 350,
}) {
  if (confirmed !== true) throw new TypeError("Synthetic load probe requires explicit confirmation");
  if (![operation, integrityProbe, recoveryProbe].every(value => typeof value === "function")) {
    throw new TypeError("Synthetic load probe requires operation, integrity and recovery probes");
  }
  if (!Number.isSafeInteger(peakUsers) || peakUsers < 300 || peakUsers > 1000) {
    throw new TypeError("Synthetic load peak must be between 300 and 1000 users");
  }
  const stages = [];
  for (const concurrentUsers of [100, 300]) stages.push(await executeStage(concurrentUsers, operation));
  await executeStage(peakUsers, operation);
  const integrity = await integrityProbe();
  const recoveredAfterPeak = await recoveryProbe() === true;
  const report = Object.freeze({
    environment: "isolated-synthetic", syntheticDataOnly: true, stages: Object.freeze(stages),
    controlledPeak: Object.freeze({ concurrentUsers: peakUsers }),
    integrity: Object.freeze({
      lostRecords: integrity?.lostRecords,
      corruptedRecords: integrity?.corruptedRecords,
      duplicateCommitments: integrity?.duplicateCommitments,
    }),
    recoveredAfterPeak,
  });
  return Object.freeze({ report, readiness: assessLoadTestReadiness(report) });
}
