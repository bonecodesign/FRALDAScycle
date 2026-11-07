import { localIncidentDrill } from "../../packages/contracts/incident-drill.js";
import { accessLevel, requireAccessLevel, requireSectorScope } from "./authorization.js";
import { ServiceError } from "./service-error.js";

const pauseReason = "Ensaio sintético: contenção preventiva do domínio afetado.";
const resumeReason = "Ensaio sintético: critério técnico de recuperação confirmado.";
const rollbackReason = "Ensaio sintético: verificação pós-retomada falhou; domínio pausado novamente.";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function runSyntheticIncidentDrill({
  actor, founder, operationalControlService, input, clock = Date.now,
  technicalGrantId, founderGrantId,
  safeContinuationsProbe, technicalRecoveryProbe, postRecoveryProbe,
}) {
  requireSectorScope(actor, "admin:operations:write");
  requireAccessLevel(actor, 2);
  requireSectorScope(founder, "admin:operations:write");
  requireAccessLevel(founder, 5);
  if (accessLevel(actor) === 5 || actor.id === founder.id) {
    throw new ServiceError("independent_resume_approval_required", 403, "A proposta e a autorização precisam de pessoas distintas.");
  }
  if (!uuid.test(String(technicalGrantId ?? "")) || !uuid.test(String(founderGrantId ?? ""))) {
    throw new ServiceError("incident_drill_step_up_required", 422, "Confirmações de segurança independentes são obrigatórias.");
  }
  if (input?.confirmed !== true || input?.environment !== "isolated-local" || input?.syntheticDataOnly !== true) {
    throw new ServiceError("invalid_incident_drill_confirmation", 422, "Confirme o ensaio isolado com dados exclusivamente sintéticos.");
  }
  for (const probe of [safeContinuationsProbe, technicalRecoveryProbe, postRecoveryProbe]) {
    if (typeof probe !== "function") throw new TypeError("Incident drill probe is required");
  }
  for (const method of ["change", "assertAvailable", "proposeResume", "decideResume"]) {
    if (typeof operationalControlService?.[method] !== "function") {
      throw new TypeError("Incident drill requires the joint resume approval service");
    }
  }

  const startedAt = new Date(clock()).toISOString();
  const record = {
    version: input.version, environment: "isolated-local", syntheticDataOnly: true,
    startedAt, scenario: input.scenario, severity: input.severity, roles: input.roles,
    internalChannel: input.internalChannel,
    containment: { domain: input.domain, version: 1, auditAction: "operations.paused", reason: pauseReason },
    recovery: { authorized: input.recovery?.authorized === true, authorizedBy: input.recovery?.authorizedBy,
      recoveredAt: startedAt, auditAction: "operations.resumed", criterion: input.recovery?.criterion },
    findings: [...(input.findings ?? []), "Nenhum fornecedor, pagamento, usuário ou mensagem real foi acionado."],
  };
  // Validate all evidence fields before changing operational state.
  localIncidentDrill(record);

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

  // The direct 'resume' command is forbidden by the production control service.
  // Both confirmations must be verified and consumed by the approval service.
  const proposal = await operationalControlService.proposeResume(actor, {
    domain: input.domain, reason: resumeReason, grantId: technicalGrantId,
  });
  if (!uuid.test(String(proposal?.request?.id ?? ""))) {
    throw new Error("Incident drill resume proposal is missing; domain remains paused");
  }
  const decision = await operationalControlService.decideResume(founder, proposal.request.id, {
    approved: true, reason: resumeReason, grantId: founderGrantId,
  });
  if (decision?.request?.status !== "approved" || decision?.state?.paused !== false) {
    throw new Error("Incident drill joint resume approval was not granted; domain remains paused");
  }
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
    ...record,
    containment: { ...record.containment, version: paused.state.version },
    recovery: { ...record.recovery, recoveredAt },
  });
}
