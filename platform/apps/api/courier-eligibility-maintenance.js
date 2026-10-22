const HOUR_MS = 60 * 60 * 1000;

export function createCourierEligibilityMaintenanceWorker(repository, {
  notificationAdapter = null,
  restrictedStorageAdapter = null,
  clock = Date.now,
} = {}) {
  async function process(task, now) {
    const context = await repository.maintenanceTaskContext(task);
    if (!context) return { outcome: "stale_claim" };
    if (task.task_kind === "support_sla_close") {
      const result = await repository.closeSupportSlaTask(task, now);
      return { outcome: result.closed ? "support_case_closed" : "support_case_already_resolved" };
    }
    if (task.task_kind === "renewal_notice") {
      if (!notificationAdapter) return { defer: "notification_adapter_not_configured" };
      await notificationAdapter.renewalNotice(context);
      return { outcome: "renewal_notice_queued" };
    }
    if (task.task_kind === "support_escalation") {
      if (!notificationAdapter) return { defer: "notification_adapter_not_configured" };
      await notificationAdapter.supportEscalation(context);
      return { outcome: "support_escalation_queued" };
    }
    if (task.task_kind === "clearance_copy_delete") {
      if (!restrictedStorageAdapter) return { defer: "restricted_storage_adapter_not_configured" };
      await restrictedStorageAdapter.deleteObject(context.encrypted_object_reference);
      return { outcome: "clearance_copy_deleted" };
    }
    throw new Error("unsupported maintenance task");
  }

  return Object.freeze({
    async run({ limit = 20 } = {}) {
      const nowMs = clock();
      const now = new Date(nowMs).toISOString();
      const tasks = await repository.claimMaintenanceTasks({ limit, now });
      const summary = { claimed: tasks.length, completed: 0, deferred: 0, failed: 0 };
      for (const task of tasks) {
        try {
          const result = await process(task, now);
          if (result.defer) {
            await repository.deferMaintenanceTask(task, {
              availableAt: new Date(nowMs + HOUR_MS).toISOString(), reason: result.defer,
            });
            summary.deferred += 1;
          } else {
            await repository.completeMaintenanceTask(task, { now, outcome: result.outcome });
            summary.completed += 1;
          }
        } catch (error) {
          await repository.failMaintenanceTask(task, {
            availableAt: new Date(nowMs + HOUR_MS).toISOString(),
            error: error?.message || "maintenance task failed",
          });
          summary.failed += 1;
        }
      }
      return summary;
    },
  });
}
