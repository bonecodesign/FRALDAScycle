import { loadConfig } from "../apps/api/config.js";
import { createDatabase } from "../database/client.js";
import { createNotificationRepository } from "../database/notification-repository.js";

export function backoffSeconds(attempt) {
  return Math.min(3600, 15 * (2 ** Math.max(0, attempt - 1)));
}

export async function deliverNotification(job, config, fetchImpl = fetch) {
  if (!config.notificationWebhookUrl || !config.notificationWebhookSecret) {
    throw new Error("Notification delivery is not configured");
  }
  const response = await fetchImpl(config.notificationWebhookUrl, {
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
  if (!response.ok) throw new Error(`Notification provider returned ${response.status}`);
}

export async function runNotificationBatch(repository, config, fetchImpl = fetch) {
  await repository.recoverStaleLocks();
  const jobs = await repository.claimBatch(20);
  for (const job of jobs) {
    try {
      await deliverNotification(job, config, fetchImpl);
      await repository.delivered(job.id);
    } catch (error) {
      await repository.failed(job.id, error.message, backoffSeconds(job.attempts));
    }
  }
  return jobs.length;
}

async function main() {
  const config = loadConfig();
  const database = createDatabase(config);
  const repository = createNotificationRepository(database);
  try {
    const count = await runNotificationBatch(repository, config);
    console.log(`Notification jobs processed: ${count}`);
  } finally {
    await database.close();
  }
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
