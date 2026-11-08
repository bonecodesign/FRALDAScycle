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
    async completeMaintenanceTask(task, result) { completed.push([task.id, result.outcome]); return true; },
    async deferMaintenanceTask() { throw new Error("unexpected defer"); },
    async failMaintenanceTask() { throw new Error("unexpected failure"); },
  };
  const worker = createCourierEligibilityMaintenanceWorker(repository, {
    notificationAdapter: {
      async renewalNotice(context) { effects.push(["renewal", context.id]); },
      async supportEscalation(context) { effects.push(["escalation", context.id]); },
    },
    restrictedStorageAdapter: {
      async deleteObject(reference) {
        effects.push(["delete", reference]);
        return {
          deleted: true,
          objectReference: reference,
          confirmationReference: "receipt_2030_fixture_01",
          confirmedAt: "2030-01-01T12:00:00.000Z",
        };
      },
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

test("deletion requires a matching, auditable explicit storage receipt", async () => {
  const reference = "restricted/object/synthetic";
  const good = {
    deleted: true,
    objectReference: reference,
    confirmationReference: "synthetic_receipt_123456",
    confirmedAt: "2030-01-01T12:00:00Z",
  };
  for (const response of [
    undefined, false, true, {}, { deleted: true },
    { ...good, deleted: false },
    { ...good, objectReference: "restricted/object/other" },
    { ...good, confirmationReference: "" },
    { ...good, confirmationReference: "https://public.example/receipt" },
    { ...good, confirmedAt: "invalid" },
  ]) {
    const completed = [], failed = [];
    const worker = createCourierEligibilityMaintenanceWorker({
      async claimMaintenanceTasks() { return [tasks[3]]; },
      async maintenanceTaskContext() { return { encrypted_object_reference: reference }; },
      async completeMaintenanceTask(_task, value) { completed.push(value); },
      async failMaintenanceTask(_task, value) { failed.push(value); },
    }, {
      restrictedStorageAdapter: { async deleteObject() { return response; } },
      clock: () => Date.parse("2030-01-01T12:00:00Z"),
    });
    assert.deepEqual(await worker.run(), { claimed: 1, completed: 0, deferred: 0, failed: 1 });
    assert.deepEqual(completed, []);
    assert.equal(failed[0].error, "restricted_storage_deletion_not_confirmed");
  }
});

test("deletion receipt is forwarded without disclosing the object reference in completion metadata", async () => {
  const reference = "restricted/object/synthetic";
  const completed = [];
  const worker = createCourierEligibilityMaintenanceWorker({
    async claimMaintenanceTasks() { return [tasks[3]]; },
    async maintenanceTaskContext() { return { encrypted_object_reference: reference }; },
    async completeMaintenanceTask(_task, value) { completed.push(value); return true; },
    async failMaintenanceTask() { throw new Error("must not fail"); },
  }, {
    restrictedStorageAdapter: {
      async deleteObject(objectReference) {
        assert.equal(objectReference, reference);
        return {
          deleted: true, objectReference, confirmationReference: "synthetic_receipt_123456",
          confirmedAt: "2030-01-01T12:00:00Z",
        };
      },
    },
    clock: () => Date.parse("2030-01-01T12:00:00Z"),
  });
  assert.deepEqual(await worker.run(), { claimed: 1, completed: 1, deferred: 0, failed: 0 });
  assert.deepEqual(completed, [{
    now: "2030-01-01T12:00:00.000Z", outcome: "clearance_copy_deleted",
    deletionConfirmation: { reference: "synthetic_receipt_123456", confirmedAt: "2030-01-01T12:00:00Z" },
    expectedObjectReference: reference,
  }]);
  assert.equal(JSON.stringify(completed).includes(reference), false);
});

test("deletion with a missing object reference fails without calling storage", async () => {
  let calls = 0;
  const completed = [], failures = [];
  const worker = createCourierEligibilityMaintenanceWorker({
    async claimMaintenanceTasks() { return [tasks[3]]; },
    async maintenanceTaskContext() { return { encrypted_object_reference: null }; },
    async completeMaintenanceTask(_task, value) { completed.push(value); },
    async failMaintenanceTask(_task, value) { failures.push(value); },
  }, {
    restrictedStorageAdapter: { async deleteObject() { calls++; return { deleted: true }; } },
    clock: () => Date.parse("2030-01-01T12:00:00Z"),
  });
  assert.deepEqual(await worker.run(), { claimed: 1, completed: 0, deferred: 0, failed: 1 });
  assert.equal(calls, 0);
  assert.deepEqual(completed, []);
  assert.equal(failures[0].error, "restricted_storage_reference_missing");
});

test("storage deletion adapter errors never complete a clearance task", async () => {
  const completed = [], failures = [];
  const worker = createCourierEligibilityMaintenanceWorker({
    async claimMaintenanceTasks() { return [tasks[3]]; },
    async maintenanceTaskContext() { return { encrypted_object_reference: "restricted/object/synthetic" }; },
    async completeMaintenanceTask(_task, value) { completed.push(value); },
    async failMaintenanceTask(_task, value) { failures.push(value); },
  }, {
    restrictedStorageAdapter: { async deleteObject() { throw new Error("synthetic provider failure"); } },
    clock: () => Date.parse("2030-01-01T12:00:00Z"),
  });
  assert.deepEqual(await worker.run(), { claimed: 1, completed: 0, deferred: 0, failed: 1 });
  assert.deepEqual(completed, []);
  assert.equal(failures[0].error, "synthetic provider failure");
});

test("P-01 never counts a failed database completion as a successful copy deletion", async () => {
  const failed = [];
  const worker = createCourierEligibilityMaintenanceWorker({
    async claimMaintenanceTasks() { return [tasks[3]]; },
    async maintenanceTaskContext() { return { encrypted_object_reference: "restricted/object/1" }; },
    async completeMaintenanceTask() { return false; },
    async failMaintenanceTask(_task, input) { failed.push(input.error); },
  }, {
    restrictedStorageAdapter: { async deleteObject(objectReference) {
      return { deleted: true, objectReference, confirmationReference: "synthetic_receipt_123456",
        confirmedAt: "2030-01-01T12:00:00Z" };
    } },
    clock: () => Date.parse("2030-01-01T12:00:00Z"),
  });
  assert.deepEqual(await worker.run(), { claimed: 1, completed: 0, deferred: 0, failed: 1 });
  assert.deepEqual(failed, ["restricted_storage_deletion_commit_not_confirmed"]);
});

test("P-01 missing task context never invokes deletion or marks a document as deleted", async () => {
  let invoked = 0;
  const deferred = [];
  const worker = createCourierEligibilityMaintenanceWorker({
    async claimMaintenanceTasks() { return [tasks[3]]; },
    async maintenanceTaskContext() { return null; },
    async completeMaintenanceTask() { assert.fail("stale claim must not be completed"); },
    async deferMaintenanceTask(_task, request) { deferred.push(request.reason); return true; },
  }, {
    restrictedStorageAdapter: { async deleteObject() { invoked++; return { deleted: true }; } },
    clock: () => Date.parse("2030-01-01T12:00:00Z"),
  });
  assert.deepEqual(await worker.run(), { claimed: 1, completed: 0, deferred: 1, failed: 0 });
  assert.equal(invoked, 0);
  assert.deepEqual(deferred, ["maintenance_claim_missing"]);
});
