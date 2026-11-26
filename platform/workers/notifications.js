import { readFile } from "node:fs/promises";
import { resolveRuntimeEnv, validateSecretsProviderConfig } from "../apps/api/secrets.js";
import { validateExternalProviderEndpoint } from "../apps/api/external-provider-endpoint.js";
import { isMainModule } from "../packages/contracts/main-module.js";
import { createDatabase } from "../database/client.js";
import { createNotificationRepository } from "../database/notification-repository.js";
import { notificationDispatchDecision } from "../apps/api/operational-preferences.js";

const OPTIONAL_REMINDERS = new Set(["payment_reminder", "delivery_reminder", "general_reminder"]);

export function backoffSeconds(attempt) {
  return Math.min(3600, 15 * (2 ** Math.max(0, attempt - 1)));
}

const CHILD_AGE_EVENTS = new Set(["child_profile_age_limit_warning", "child_profile_age_limit_closed"]);
const REQUIRED_OPERATIONAL_EVENTS = new Set([
  "payment.authorized", "payment.paid", "payment.failed", "payment.refunded", "payment.disputed",
  "shipment.assigned", "shipment.picked_up", "shipment.in_transit", "shipment.delivered",
  "shipment.failed", "shipment.cancelled", "receipt.approved", "proof.validated",
]);

/**
 * A provider must never receive child profile attributes from historical jobs.
 * Legacy pending outbox rows may contain emoji; whitelist the two supported
 * fields at the final dispatch boundary without mutating or inventing evidence.
 */
export function notificationPayloadForDispatch(job) {
  if (job?.kind === "operational_required_notice") {
    if (job.payload?.channel !== "email" || !REQUIRED_OPERATIONAL_EVENTS.has(job.payload?.event)
      || Object.keys(job.payload).some(key => !["channel", "event"].includes(key))) {
      throw new Error("Required operational notification payload is not supported");
    }
    return { channel: "email", event: job.payload.event };
  }
  if (job?.kind !== "account_lifecycle_notice") return job?.payload;
  // This notification kind is exclusive to child age lifecycle messages.
  // Missing events or unexpected payloads must never bypass minimization.
  if (!CHILD_AGE_EVENTS.has(job.payload?.event) || job.payload?.channel !== "email") {
    throw new Error("Child profile lifecycle notification payload is not supported");
  }
  return { channel: "email", event: job.payload.event };
}

export async function deliverNotification(job, config, fetchImpl = fetch) {
  if (!config.notificationWebhookUrl || !config.notificationWebhookSecret) {
    throw new Error("Notification delivery is not configured");
  }
  let endpoint;
  try { endpoint = new URL(config.notificationWebhookUrl); }
  catch { throw new Error("Notification provider URL must be HTTPS without credentials or query"); }
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error("Notification provider URL must be HTTPS without credentials or query");
  }
  // Reject unsupported child lifecycle payloads *before* the transport
  // handler, so privacy-policy failures cannot masquerade as provider outages.
  const outboundPayload = notificationPayloadForDispatch(job);
  let response;
  try {
    response = await fetchImpl(config.notificationWebhookUrl, {
      method: "POST",
      redirect: "error",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.notificationWebhookSecret}`,
        "idempotency-key": job.id,
      },
      body: JSON.stringify({
        id: job.id,
        kind: job.kind,
        recipient: job.recipient,
        payload: outboundPayload,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Transport errors may contain request credentials or recipient details.
    throw new Error("Notification provider is unavailable");
  }
  if (!response.ok) throw new Error(`Notification provider returned ${response.status}`);
}

export async function runNotificationBatch(repository, config, fetchImpl = fetch, now = () => new Date()) {
  await repository.recoverStaleLocks();
  const jobs = await repository.claimBatch(20);
  for (const job of jobs) {
    try {
      if (!await repository.canDeliver(job.id, job.claim_token)) {
        await repository.cancelled(job.id, job.claim_token, OPTIONAL_REMINDERS.has(job.kind));
        continue;
      }
      if (OPTIONAL_REMINDERS.has(job.kind)) {
        const preferences = await repository.operationalPreferences(job.preference_user_id);
        const channel = job.payload?.channel;
        if (!preferences.configured || preferences.channels?.[channel] !== true) {
          await repository.cancelledByPreference(job.id, job.claim_token);
          continue;
        }
        if (notificationDispatchDecision(job.kind, preferences, now()) === "defer") {
          await repository.defer(job.id, job.claim_token, 900);
          continue;
        }
      }
      await deliverNotification(job, config, fetchImpl);
      await repository.delivered(job.id, job.claim_token);
    } catch (error) {
      // Internal failures may include recipient details, tokens or SQL values.
      // Persist only a fixed, non-sensitive diagnostic in the outbox.
      await repository.failed(job.id, "Notification processing failed", backoffSeconds(job.attempts), job.claim_token);
    }
  }
  return jobs.length;
}

export async function loadNotificationConfig(env = process.env, options = {}) {
  const manifest = JSON.parse(await readFile(new URL("../config/secret-access.v1.json", import.meta.url), "utf8"));
  const scope = manifest.services?.notifications;
  if (!Array.isArray(scope) || scope.length !== 2 ||
      !scope.includes("DATABASE_URL") || !scope.includes("NOTIFICATION_WEBHOOK_SECRET")) {
    throw new Error("Notification secret scope is invalid");
  }
  const provider = validateSecretsProviderConfig(env);
  if (provider?.keys.some(key => !scope.includes(key))) {
    throw new Error("Notification worker requested a secret outside its scope");
  }
  const resolved = await resolveRuntimeEnv(env, options);
  const url = resolved.NOTIFICATION_WEBHOOK_URL ?? null;
  const secret = resolved.NOTIFICATION_WEBHOOK_SECRET ?? null;
  if (Boolean(url) !== Boolean(secret)) {
    throw new Error("NOTIFICATION_WEBHOOK_URL and NOTIFICATION_WEBHOOK_SECRET must be configured together");
  }
  if (resolved.NODE_ENV === "production") {
    for (const key of ["DATABASE_URL", "NOTIFICATION_WEBHOOK_URL", "NOTIFICATION_WEBHOOK_SECRET"]) {
      if (!resolved[key]) throw new Error(`Missing required production configuration: ${key}`);
    }
  }
  // Use the same PostgreSQL transport controls as the API, but do not
  // require or return its session secret or unrelated provider settings.
  return Object.freeze({
    databaseUrl: resolved.DATABASE_URL ?? null,
    databaseSsl: resolved.DATABASE_SSL === "true",
    databaseSslCa: resolved.DATABASE_SSL_CA ?? null,
    supabaseInfrastructureEnabled: resolved.SUPABASE_INFRASTRUCTURE_ENABLED === "true",
    notificationWebhookUrl: url == null ? null : validateExternalProviderEndpoint(url, "NOTIFICATION_WEBHOOK_URL"),
    notificationWebhookSecret: secret,
  });
}

async function main() {
  const config = await loadNotificationConfig();
  const database = createDatabase(config);
  const repository = createNotificationRepository(database);
  try {
    const count = await runNotificationBatch(repository, config);
    console.log(`Notification jobs processed: ${count}`);
  } finally {
    await database.close();
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
