import assert from "node:assert/strict";
import test from "node:test";
import { createCourierEligibilityMaintenanceWorker } from "../apps/api/courier-eligibility-maintenance.js";

const tasks = [
  { id: "notice", task_kind: "renewal_notice", claim_token: "claim-1" },
  { id: "escalation", task_kind: "support_escalation", claim_token: "claim-2" },
  { id: "close", task_kind: "support_sla_close", claim_token: "claim-3" },
  { id: "delete", task_kind: "clearance_copy_delete", claim_token: "claim-4" },
];

test("worker completes internal SLA close and defers unavailable external effects without consuming attempts", async () => {
  const completed = [], deferred = [];
  const repository = {
    async claimMaintenanceTasks() { return tasks; },
    async maintenanceTaskContext(task) { return { id: task.id, encrypted_object_reference: "restricted/object/1" }; },
    async closeSupportSlaTask() { return { closed: true }; },
    async completeMaintenanceTask(task, result) { completed.push([task.id, result]); },
    async deferMaintenanceTask(task, result) { deferred.push([task.id, result]); },
    async failMaintenanceTask() { throw new Error("unexpected failure"); },
  };
  const worker = createCourierEligibilityMaintenanceWorker(repository, {
    clock: () => Date.parse("2030-01-01T12:00:00Z"),
  });
  const result = await worker.run();
  assert.deepEqual(result, { claimed: 4, completed: 1, deferred: 3, failed: 0 });
  assert.equal(completed[0][0], "close");
  assert.deepEqual(deferred.map(([id]) => id), ["notice", "escalation", "delete"]);
  assert.ok(deferred.every(([, value]) => value.availableAt === "2030-01-01T13:00:00.000Z"));
});

test("configured adapters execute notices and restricted deletion by opaque reference", async () => {
  const effects = [], completed = [];
  const repository = {
    async claimMaintenanceTasks() { return tasks.filter(task => task.id !== "close"); },
    async maintenanceTaskContext(task) { return { id: task.id, encrypted_object_reference: "restricted/object/1" }; },
    async completeMaintenanceTask(task, result) { completed.push([task.id, result.outcome]); },
    async deferMaintenanceTask() { throw new Error("unexpected defer"); },
    async failMaintenanceTask() { throw new Error("unexpected failure"); },
  };
  const worker = createCourierEligibilityMaintenanceWorker(repository, {
    notificationAdapter: {
      async renewalNotice(context) { effects.push(["renewal", context.id]); },
      async supportEscalation(context) { effects.push(["escalation", context.id]); },
    },
    restrictedStorageAdapter: {
      async deleteObject(reference) { effects.push(["delete", reference]); },
    },
    clock: () => Date.parse("2030-01-01T12:00:00Z"),
  });
  assert.deepEqual(await worker.run(), { claimed: 3, completed: 3, deferred: 0, failed: 0 });
  assert.deepEqual(effects, [["renewal", "notice"], ["escalation", "escalation"], ["delete", "restricted/object/1"]]);
  assert.deepEqual(completed.map(([id]) => id), ["notice", "escalation", "delete"]);
});

test("adapter failure is retried later and never marked completed", async () => {
  const failures = [];
  const repository = {
    async claimMaintenanceTasks() { return [tasks[0]]; },
    async maintenanceTaskContext() { return { id: "notice" }; },
    async failMaintenanceTask(task, result) { failures.push([task.id, result]); },
    async completeMaintenanceTask() { throw new Error("unexpected completion"); },
  };
  const worker = createCourierEligibilityMaintenanceWorker(repository, {
    notificationAdapter: { async renewalNotice() { throw new Error("provider timeout"); } },
    clock: () => Date.parse("2030-01-01T12:00:00Z"),
  });
  assert.deepEqual(await worker.run(), { claimed: 1, completed: 0, deferred: 0, failed: 1 });
  assert.equal(failures[0][1].error, "provider timeout");
});
