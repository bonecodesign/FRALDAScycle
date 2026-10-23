import { localIncidentDrill } from "../../packages/contracts/incident-drill.js";
import { requireScope } from "./authorization.js";
import { ServiceError } from "./service-error.js";

const pauseReason = "Ensaio sintético: contenção preventiva do domínio afetado.";
const resumeReason = "Ensaio sintético: critério técnico de recuperação confirmado.";
const rollbackReason = "Ensaio sintético: verificação pós-retomada falhou; domínio pausado novamente.";

export async function runSyntheticIncidentDrill({
  actor, operationalControlService, input, clock = Date.now,
  safeContinuationsProbe, technicalRecoveryProbe, postRecoveryProbe,
}) {
  requireScope(actor, "admin:operations:write");
  if (input?.confirmed !== true || input?.environment !== "isolated-local" || input?.syntheticDataOnly !== true) {
    throw new ServiceError("invalid_incident_drill_confirmation", 422, "Confirme o ensaio isolado com dados exclusivamente sintéticos.");
  }
  for (const probe of [safeContinuationsProbe, technicalRecoveryProbe, postRecoveryProbe]) {
    if (typeof probe !== "function") throw new TypeError("Incident drill probe is required");
  }
  const startedAt = new Date(clock()).toISOString();
  const paused = await operationalControlService.change(actor, {
    domain: input.domain, action: "pause", reason: pauseReason, confirmed: true,
  });
  try {
    await operationalControlService.assertAvailable(input.domain);
    throw new Error("Incident drill containment did not block new commitments");
  } catch (error) {
    if (error?.code !== "operational_paused") throw error;
  }
  if (await safeContinuationsProbe() !== true) {
    throw new Error("Incident drill safe continuations probe failed; domain remains paused");
  }
  if (await technicalRecoveryProbe() !== true) {
    throw new Error("Incident drill recovery probe failed; domain remains paused");
  }
  await operationalControlService.change(actor, {
    domain: input.domain, action: "resume", reason: resumeReason, confirmed: true,
  });
  try {
    await operationalControlService.assertAvailable(input.domain);
    if (await postRecoveryProbe() !== true) throw new Error("post-recovery probe failed");
  } catch (error) {
    await operationalControlService.change(actor, {
      domain: input.domain, action: "pause", reason: rollbackReason, confirmed: true,
    });
    throw new Error(`Incident drill rollback applied: ${error.message}`);
  }
  const recoveredAt = new Date(clock()).toISOString();
  return localIncidentDrill({
    version: input.version, environment: "isolated-local", syntheticDataOnly: true,
    startedAt, scenario: input.scenario, severity: input.severity, roles: input.roles,
    internalChannel: input.internalChannel,
    containment: { domain: input.domain, version: paused.state.version, auditAction: "operations.paused", reason: pauseReason },
    recovery: { authorized: input.recovery?.authorized === true, authorizedBy: input.recovery?.authorizedBy,
      recoveredAt, auditAction: "operations.resumed", criterion: input.recovery?.criterion },
    findings: [...(input.findings ?? []), "Nenhum fornecedor, pagamento, usuário ou mensagem real foi acionado."],
  });
}
