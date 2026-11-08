const HOUR_MS = 60 * 60 * 1000;

export function createCourierEligibilityMaintenanceWorker(repository, {
  notificationAdapter = null,
  restrictedStorageAdapter = null,
  clock = Date.now,
} = {}) {
  async function process(task, now) {
    const context = await repository.maintenanceTaskContext(task);
    if (!context) return task.task_kind === "clearance_copy_delete" ? { defer: "maintenance_claim_missing" } : { outcome: "stale_claim" };
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
      if (typeof restrictedStorageAdapter?.deleteObject !== "function") {
        return { defer: "restricted_storage_adapter_not_configured" };
      }
      const objectReference = context.encrypted_object_reference;
      if (typeof objectReference !== "string" || !objectReference.trim()) {
        throw new Error("restricted_storage_reference_missing");
      }
      // A successful promise or HTTP 2xx is not proof of deletion. The
      // storage adapter must explicitly attest to this exact opaque object.
      const receipt = await restrictedStorageAdapter.deleteObject(objectReference);
      if (receipt?.deleted !== true || receipt?.objectReference !== objectReference ||
          typeof receipt?.confirmationReference !== "string" ||
          !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{7,127}$/.test(receipt.confirmationReference) ||
          typeof receipt?.confirmedAt !== "string" ||
          !Number.isFinite(Date.parse(receipt.confirmedAt))) {
        throw new Error("restricted_storage_deletion_not_confirmed");
      }
      return {
        outcome: "clearance_copy_deleted",
        deletionConfirmation: {
          reference: receipt.confirmationReference,
          confirmedAt: receipt.confirmedAt,
        },
        expectedObjectReference: objectReference,
      };
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
            const completed = await repository.completeMaintenanceTask(task, {
              now, outcome: result.outcome,
              deletionConfirmation: result.deletionConfirmation ?? null,
              expectedObjectReference: result.expectedObjectReference ?? null,
            });
            if (task.task_kind === "clearance_copy_delete" && completed !== true) {
              throw new Error("restricted_storage_deletion_commit_not_confirmed");
            }
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
