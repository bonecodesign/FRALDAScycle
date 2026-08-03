const SAFE_EVENT_FIELDS = new Set([
  "type", "requestId", "method", "route", "status", "durationMs", "errorCode", "service",
]);

function sanitize(event) {
  const safe = {};
  for (const [key, value] of Object.entries(event ?? {})) {
    if (!SAFE_EVENT_FIELDS.has(key) || value == null) continue;
    safe[key] = typeof value === "string" ? value.slice(0, 256) : value;
  }
  return { timestamp: new Date().toISOString(), service: "fraldacycle-api", ...safe };
}

export function createTelemetry(config, {
  fetchImpl = fetch,
  write = (line) => process.stdout.write(line + "\n"),
} = {}) {
  const endpoint = config.telemetryProviderUrl ? new URL(config.telemetryProviderUrl) : null;
  const secret = config.telemetryProviderSecret;

  return Object.freeze({
    mode: endpoint ? "hosted" : "structured-log",
    async record(event) {
      const payload = sanitize(event);
      write(JSON.stringify(payload));
      if (!endpoint) return true;
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(2_000),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
  });
}
