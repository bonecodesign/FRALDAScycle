const SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const DOMAINS = new Set(["global", "payments", "marketplace", "logistics", "donations"]);
const FORBIDDEN_KEY = /(password|secret|token|authorization|cookie|cpf|document)/i;

function text(value, name, minimum = 3, maximum = 500) {
  const result = String(value ?? "").trim();
  if (result.length < minimum || result.length > maximum) throw new TypeError(`Invalid incident drill ${name}`);
  return result;
}

function timestamp(value, name) {
  const result = String(value ?? "");
  if (!Number.isFinite(Date.parse(result))) throw new TypeError(`Invalid incident drill ${name}`);
  return new Date(result).toISOString();
}

function rejectSensitiveKeys(value, path = "record") {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key)) throw new TypeError(`Sensitive field is not allowed in incident drill: ${path}.${key}`);
    rejectSensitiveKeys(nested, `${path}.${key}`);
  }
}

export function localIncidentDrill(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Invalid incident drill record");
  rejectSensitiveKeys(input);
  const severity = String(input.severity ?? "");
  const domain = String(input.containment?.domain ?? "");
  if (!SEVERITIES.has(severity) || !DOMAINS.has(domain)) throw new TypeError("Invalid incident drill classification");
  if (input.environment !== "isolated-local" || input.syntheticDataOnly !== true) throw new TypeError("Incident drill must stay isolated and synthetic");
  if (input.containment?.auditAction !== "operations.paused" || !Number.isSafeInteger(input.containment?.version) || input.containment.version < 1) throw new TypeError("Incident drill pause evidence is incomplete");
  if (input.recovery?.auditAction !== "operations.resumed" || input.recovery?.authorized !== true) throw new TypeError("Incident drill recovery evidence is incomplete");
  const startedAt = timestamp(input.startedAt, "start time");
  const recoveredAt = timestamp(input.recovery.recoveredAt, "recovery time");
  if (Date.parse(recoveredAt) < Date.parse(startedAt)) throw new TypeError("Incident drill recovery precedes its start");
  return Object.freeze({
    version: text(input.version, "version", 7, 80), environment: "isolated-local", syntheticDataOnly: true,
    startedAt, scenario: text(input.scenario, "scenario", 10, 500), severity,
    roles: Object.freeze({ triage: text(input.roles?.triage, "triage role"), technical: text(input.roles?.technical, "technical role"), substitute: text(input.roles?.substitute, "substitute role") }),
    internalChannel: text(input.internalChannel, "internal channel"),
    containment: Object.freeze({ domain, version: input.containment.version, auditAction: "operations.paused", reason: text(input.containment.reason, "containment reason", 10, 500) }),
    recovery: Object.freeze({ authorized: true, authorizedBy: text(input.recovery.authorizedBy, "recovery authorization"), recoveredAt, auditAction: "operations.resumed", criterion: text(input.recovery.criterion, "recovery criterion", 10, 500) }),
    findings: Object.freeze((input.findings ?? []).map((finding, index) => text(finding, `finding ${index + 1}`, 3, 500))),
  });
}
