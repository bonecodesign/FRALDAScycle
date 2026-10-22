import assert from "node:assert/strict";
import test from "node:test";
import { createCourierEligibilityService } from "../apps/api/courier-eligibility-service.js";

const courierId = "11111111-1111-4111-8111-111111111111";
const documentId = "22222222-2222-4222-8222-222222222222";

test("courier reads only their own operational status while admin may inspect another profile", async () => {
  const calls = [];
  const service = createCourierEligibilityService({
    async status(id) { calls.push(id); return { profile: { user_id: id } }; },
  });
  assert.equal((await service.status({ id: courierId, role: "courier" })).profile.user_id, courierId);
  assert.equal((await service.status({ id: "admin-1", role: "admin" }, courierId)).profile.user_id, courierId);
  await assert.rejects(
    service.status({ id: "33333333-3333-4333-8333-333333333333", role: "courier" }, courierId),
    error => error.code === "forbidden",
  );
  assert.equal(calls.length, 2);
});

test("restricted clearance access requires admin scope and an explicit auditable purpose", async () => {
  let received;
  const service = createCourierEligibilityService({
    async restrictedDocument(input) { received = input; return { reused: false, document: { id: documentId } }; },
  });
  await assert.rejects(
    service.restrictedDocument({ id: courierId, role: "courier" }, documentId, {
      purpose: "verification", requestReference: "request-reference-123",
    }),
    error => error.code === "forbidden",
  );
  const result = await service.restrictedDocument({ id: "admin-1", role: "admin" }, documentId, {
    purpose: "verification", requestReference: "request-reference-123",
  });
  assert.equal(result.document.id, documentId);
  assert.deepEqual(received, {
    actorId: "admin-1", documentId, purpose: "verification", requestReference: "request-reference-123",
  });
});

test("invalid purpose or weak request reference never reaches the repository", async () => {
  const service = createCourierEligibilityService({
    async restrictedDocument() { throw new Error("must not run"); },
  });
  await assert.rejects(
    service.restrictedDocument({ id: "admin-1", role: "admin" }, documentId, {
      purpose: "download", requestReference: "short",
    }),
    error => error.code === "invalid_clearance_access",
  );
});

test("courier may submit only a complete encrypted clearance reference set", async () => {
  let received;
  const service = createCourierEligibilityService({
    async submitClearance(input) { received = input; return { review: { status: "pending" } }; },
  }, { retentionPolicy: {
    status: "approved", version: "FC-PRIVACY-2026-01", legalApproverId: documentId,
  } });
  const result = await service.submitClearance({ id: courierId, role: "courier" }, {
    reviewKind: "renewal",
    encryptedObjectReference: "restricted/object/12345",
    encryptionKeyReference: "kms/key/reference/12345",
    submissionReference: "submission/reference/12345",
    submittedAt: "2030-01-01T10:00:00Z",
  });
  assert.equal(result.review.status, "pending");
  assert.equal(received.courierId, courierId);
  assert.equal(received.reviewKind, "renewal");
  assert.equal(received.retentionPolicyVersion, "FC-PRIVACY-2026-01");
  assert.equal(received.retentionLegalApproverId, documentId);
});

test("courier cannot submit while the platform retention policy is not approved", async () => {
  const service = createCourierEligibilityService({
    async submitClearance() { throw new Error("must not run"); },
  });
  await assert.rejects(service.submitClearance({ id: courierId, role: "courier" }, {
    reviewKind: "initial", encryptedObjectReference: "restricted/object/12345",
    encryptionKeyReference: "kms/key/reference/12345", submissionReference: "submission/reference/12345",
    submittedAt: "2030-01-01T10:00:00Z",
  }), error => error.code === "clearance_retention_policy_not_approved");
});

test("review approval requires official issuer validity while rejection does not invent dates", async () => {
  const calls = [];
  const service = createCourierEligibilityService({
    async decideClearanceReview(input) { calls.push(input); return input; },
  }, { clock: () => Date.parse("2030-01-01T12:00:00Z") });
  await assert.rejects(service.decideReview({ id: "admin-1", role: "admin" }, documentId, {
    decision: "approved", decidedAt: "2030-01-01T12:00:00Z", auditReference: "audit/reference/12345",
  }), error => error.code === "invalid_clearance_validity");
  const rejected = await service.decideReview({ id: "admin-1", role: "admin" }, documentId, {
    decision: "rejected", decidedAt: "2030-01-01T12:00:00Z", auditReference: "audit/reference/12345",
  });
  assert.equal(rejected.decision, "rejected");
  assert.equal(rejected.decidedAt, "2030-01-01T12:00:00.000Z");
  assert.equal(rejected.issuerVerificationReference, null);
  assert.equal(calls.length, 1);
});

test("support release request uses server time and never accepts a courier supplied deadline", async () => {
  let received;
  const service = createCourierEligibilityService({
    async openSupportReleaseRequest(input) { received = input; return { reused: false }; },
  }, { clock: () => Date.parse("2030-01-01T12:00:00Z") });
  await service.requestSupportRelease({ id: courierId, role: "courier" }, {
    requestReference: "support/request/reference/1", openedAt: "2099-01-01T00:00:00Z",
  });
  assert.equal(received.openedAt, "2030-01-01T12:00:00.000Z");
  assert.equal(received.courierId, courierId);
});

test("support release and SLA closure require support scope and server time", async () => {
  const calls = [];
  const repository = {
    async releaseSuspension(input) { calls.push(["release", input]); return { status: "released" }; },
    async closeExpiredSupportRequests(input) { calls.push(["close", input]); return { closed: 0 }; },
  };
  const service = createCourierEligibilityService(repository, {
    clock: () => Date.parse("2030-01-01T12:00:00Z"),
  });
  await assert.rejects(service.releaseSuspension({ id: courierId, role: "courier" }, documentId, {
    confirmed: true, auditReference: "support/audit/reference/1",
  }), error => error.code === "forbidden");
  await service.releaseSuspension({ id: "admin-1", role: "admin" }, documentId, {
    confirmed: true, auditReference: "support/audit/reference/1",
  });
  await service.closeExpiredSupportRequests({ id: "admin-1", role: "admin" });
  assert.equal(calls[0][1].decidedAt, "2030-01-01T12:00:00.000Z");
  assert.equal(calls[1][1].closedAt, "2030-01-01T12:00:00.000Z");
});

test("administrative queues enforce their scopes and a bounded page size", async () => {
  const calls = [];
  const service = createCourierEligibilityService({
    async pendingReviewQueue(input) { calls.push(["review", input]); return []; },
    async pendingSupportQueue(input) { calls.push(["support", input]); return []; },
  });
  await assert.rejects(service.reviewQueue({ id: courierId, role: "courier" }), error => error.code === "forbidden");
  await service.reviewQueue({ id: "admin-1", role: "admin" }, { limit: "25" });
  await service.supportQueue({ id: "admin-1", role: "admin" }, { limit: "50" });
  await assert.rejects(service.supportQueue({ id: "admin-1", role: "admin" }, { limit: "51" }),
    error => error.code === "invalid_queue_limit");
  assert.deepEqual(calls, [["review", { limit: 25 }], ["support", { limit: 50 }]]);
});

test("maintenance scheduling requires operations scope and uses only server time", async () => {
  let received;
  const service = createCourierEligibilityService({
    async scheduleMaintenanceTasks(input) { received = input; return { renewalNotice: 1 }; },
  }, { clock: () => Date.parse("2030-01-01T12:00:00Z") });
  await assert.rejects(service.scheduleMaintenance({ id: courierId, role: "courier" }), error => error.code === "forbidden");
  const result = await service.scheduleMaintenance({ id: "admin-1", role: "admin" });
  assert.equal(result.renewalNotice, 1);
  assert.deepEqual(received, { actorId: "admin-1", now: "2030-01-01T12:00:00.000Z" });
});
