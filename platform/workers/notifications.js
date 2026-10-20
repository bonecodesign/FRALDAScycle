import { loadConfig } from "../apps/api/config.js";
import { resolveRuntimeEnv } from "../apps/api/secrets.js";
import { isMainModule } from "../packages/contracts/main-module.js";
import { createDatabase } from "../database/client.js";
import { createNotificationRepository } from "../database/notification-repository.js";
import { notificationDispatchDecision } from "../apps/api/operational-preferences.js";

const OPTIONAL_REMINDERS = new Set(["payment_reminder", "delivery_reminder", "general_reminder"]);

export function backoffSeconds(attempt) {
  return Math.min(3600, 15 * (2 ** Math.max(0, attempt - 1)));
}

export async function deliverNotification(job, config, fetchImpl = fetch) {
  if (!config.notificationWebhookUrl || !config.notificationWebhookSecret) {
    throw new Error("Notification delivery is not configured");
  }
  let response;
  try {
    response = await fetchImpl(config.notificationWebhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.notificationWebhookSecret}`,
        "idempotency-key": job.id,
      },
      body: JSON.stringify({
        id: job.id,
        kind: job.kind,
        recipient: job.recipient,
        payload: job.payload,
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
      await repository.failed(job.id, error.message, backoffSeconds(job.attempts), job.claim_token);
    }
  }
  return jobs.length;
}

export async function loadNotificationConfig(env = process.env, options = {}) {
  return loadConfig(await resolveRuntimeEnv(env, options));
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
