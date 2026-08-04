import { loadConfig } from "../apps/api/config.js";

const PLACEHOLDER = /(example\.(com|test)|change-me|replace-with)/i;

const BUNDLES = Object.freeze([
  ["database", ["DATABASE_URL"]],
  ["sessions", ["SESSION_SECRET"]],
  ["notifications", ["NOTIFICATION_WEBHOOK_URL", "NOTIFICATION_WEBHOOK_SECRET"]],
  ["media", ["MEDIA_PROVIDER_URL", "MEDIA_PROVIDER_SECRET"]],
  ["geocoding", ["GEOCODING_PROVIDER_URL", "GEOCODING_PROVIDER_SECRET"]],
  ["payments", ["PAYMENT_PROVIDER_URL", "PAYMENT_PROVIDER_SECRET", "PAYMENT_WEBHOOK_SECRET", "PAYMENT_PROVIDER_SDK_URL", "PAYMENT_PROVIDER_SDK_INTEGRITY"]],
  ["logistics", ["LOGISTICS_PROVIDER_URL", "LOGISTICS_PROVIDER_SECRET", "LOGISTICS_WEBHOOK_SECRET"]],
  ["distributedRateLimit", ["RATE_LIMIT_PROVIDER_URL", "RATE_LIMIT_PROVIDER_SECRET"]],
  ["telemetry", ["TELEMETRY_PROVIDER_URL", "TELEMETRY_PROVIDER_SECRET"]],
  ["externalSecrets", ["SECRETS_PROVIDER_URL", "SECRETS_PROVIDER_TOKEN", "SECRETS_PROVIDER_KEYS"]],
]);

function usable(value) {
  return typeof value === "string" && value.length > 0 && !PLACEHOLDER.test(value);
}

export function inspectProductionReadiness(env = process.env) {
  const integrations = Object.fromEntries(BUNDLES.map(([name, keys]) => [
    name,
    { ready: keys.every((key) => usable(env[key])), missing: keys.filter((key) => !usable(env[key])) },
  ]));
  const blockers = [];
  try {
    loadConfig({ ...env, NODE_ENV: "production" });
  } catch (error) {
    blockers.push(error.message);
  }
  for (const [name, state] of Object.entries(integrations)) {
    if (!state.ready) blockers.push(`${name}: ${state.missing.join(", ")}`);
  }
  return Object.freeze({
    ready: blockers.length === 0,
    checkedAt: new Date().toISOString(),
    integrations,
    blockers,
  });
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  const report = inspectProductionReadiness();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ready) process.exitCode = 1;
}
