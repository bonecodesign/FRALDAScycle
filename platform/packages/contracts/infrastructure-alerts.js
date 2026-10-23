const METRICS = Object.freeze({
  cpuPercent: { warning: 70, critical: 90, direction: "high", label: "CPU" },
  memoryPercent: { warning: 75, critical: 90, direction: "high", label: "Memória" },
  diskPercent: { warning: 70, critical: 85, direction: "high", label: "Disco" },
  apiErrorRatePercent: { warning: 2, critical: 5, direction: "high", label: "Erros da API" },
  commonLatencyMs: { warning: 500, critical: 1500, direction: "high", label: "Latência" },
  backupAgeHours: { warning: 8, critical: 12, direction: "high", label: "Idade do backup" },
  certificateDaysRemaining: { warning: 30, critical: 7, direction: "low", label: "Certificado" },
  downtimeMinutes: { warning: 2, critical: 5, direction: "high", label: "Indisponibilidade" },
});

function level(value, rule) {
  if (rule.direction === "low") {
    if (value <= rule.critical) return "critical";
    if (value <= rule.warning) return "warning";
    return "ok";
  }
  if (value >= rule.critical) return "critical";
  if (value >= rule.warning) return "warning";
  return "ok";
}

export function evaluateInfrastructureAlerts(snapshot, { clock = Date.now, maxAgeMs = 5 * 60_000 } = {}) {
  const observedAt = Date.parse(String(snapshot?.observedAt ?? ""));
  const stale = !Number.isFinite(observedAt) || observedAt > clock() || clock() - observedAt > maxAgeMs;
  const items = [];
  const missing = [];
  for (const [metric, rule] of Object.entries(METRICS)) {
    const value = snapshot?.metrics?.[metric];
    if (!Number.isFinite(value) || value < 0) {
      missing.push(metric);
      continue;
    }
    items.push(Object.freeze({ metric, label: rule.label, value, level: level(value, rule) }));
  }
  const critical = items.filter(item => item.level === "critical").length;
  const warning = items.filter(item => item.level === "warning").length;
  const complete = missing.length === 0 && !stale;
  return Object.freeze({
    status: !complete ? "unknown" : critical ? "critical" : warning ? "warning" : "ok",
    launchHealthy: complete && critical === 0 && warning === 0,
    observedAt: Number.isFinite(observedAt) ? new Date(observedAt).toISOString() : null,
    stale,
    missing: Object.freeze(missing),
    summary: Object.freeze({ critical, warning, ok: items.length - critical - warning }),
    items: Object.freeze(items),
    notice: complete
      ? "Leitura classificada; a ativação ainda depende do ambiente homologado e dos canais de alerta."
      : "Saúde desconhecida: leitura ausente, incompleta ou antiga.",
  });
}

export const infrastructureAlertThresholds = METRICS;
