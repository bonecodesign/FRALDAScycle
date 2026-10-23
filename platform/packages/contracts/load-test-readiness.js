const REQUIRED_STAGES = Object.freeze([100, 300]);

function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

export function assessLoadTestReadiness(report) {
  const blockers = [];
  if (report?.environment !== "isolated-synthetic" || report?.syntheticDataOnly !== true) {
    blockers.push("isolated_synthetic_environment_required");
  }
  const stages = Array.isArray(report?.stages) ? report.stages : [];
  for (const concurrency of REQUIRED_STAGES) {
    const stage = stages.find(item => item?.concurrentUsers === concurrency);
    if (!stage) {
      blockers.push(`stage_${concurrency}_required`);
      continue;
    }
    if (!finiteNonNegative(stage.p95Ms) || stage.p95Ms > 500) blockers.push(`stage_${concurrency}_p95_exceeded`);
    if (!finiteNonNegative(stage.p99Ms) || stage.p99Ms > 1500) blockers.push(`stage_${concurrency}_p99_exceeded`);
    if (!finiteNonNegative(stage.internalErrorRatePercent) || stage.internalErrorRatePercent >= 1) {
      blockers.push(`stage_${concurrency}_error_rate_exceeded`);
    }
  }
  const peak = report?.controlledPeak;
  if (!Number.isSafeInteger(peak?.concurrentUsers) || peak.concurrentUsers < 300) blockers.push("controlled_peak_required");
  if (report?.integrity?.lostRecords !== 0) blockers.push("record_loss_detected");
  if (report?.integrity?.corruptedRecords !== 0) blockers.push("record_corruption_detected");
  if (report?.integrity?.duplicateCommitments !== 0) blockers.push("duplicate_commitments_detected");
  if (report?.recoveredAfterPeak !== true) blockers.push("post_peak_recovery_required");

  const uniqueBlockers = Object.freeze([...new Set(blockers)]);
  return Object.freeze({
    status: uniqueBlockers.length ? "blocked" : "synthetic-pass",
    launchAuthorized: false,
    blockers: uniqueBlockers,
    requiredStages: REQUIRED_STAGES,
    notice: uniqueBlockers.length
      ? "Carga sintética não atende ao portão técnico."
      : "Carga sintética atende ao contrato; homologação na infraestrutura escolhida continua obrigatória.",
  });
}
