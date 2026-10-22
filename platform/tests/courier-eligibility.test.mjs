import assert from "node:assert/strict";
import test from "node:test";
import {
  PILOT_COURIER_VEHICLES,
  courierEligibility,
  policeClearanceExpiryEffects,
  policeClearanceRejectionEffects,
} from "../packages/contracts/courier-eligibility.js";

const now = Date.parse("2030-01-01T12:00:00Z");
const complete = {
  accountActive: true, identityStatus: "verified", adultConfirmed: true,
  emailVerified: true, phoneVerified: true,
  vehicle: { type: "motorcycle", approved: true },
  driverLicense: { status: "verified", expiresAt: "2031-01-01T00:00:00Z" },
  payoutAccount: { status: "verified", providerReference: "payout-account-1" },
  policeClearance: {
    status: "verified", issuer: "police_civil", validitySource: "issuer_document",
    verificationReference: "clearance-1", issuedAt: "2029-12-01T00:00:00Z", expiresAt: "2031-01-01T00:00:00Z",
    review: {
      method: "official_police_civil_channel", reviewerId: "admin-clearance-1",
      verifiedAt: "2029-12-02T00:00:00Z", auditReference: "audit-clearance-1",
    },
    storage: {
      mode: "encrypted_restricted", encryptionStatus: "encrypted",
      storageReference: "restricted-object-1", keyReference: "courier-clearance-key-1",
      accessScope: "courier_clearance_reviewers", accessLoggingEnabled: true,
      retention: {
        status: "approved", policyVersion: "FC-PRIVACY-1", legalApproverId: "legal-1",
        deleteAt: "2031-01-31T00:00:00Z",
      },
    },
  },
  terms: { version: "FC-COURIER-1", accepted: true },
  adminApproval: { status: "approved", reviewerId: "admin-1" },
};

test("a fully verified courier may receive delivery offers", () => {
  assert.deepEqual(courierEligibility(complete, { now }), {
    eligible: true, blockers: [], mayReceiveOffers: true, policeClearanceRenewalNoticeDue: false,
    policeClearanceProvisional: false, administrativeReviewDueAt: null,
    supportReviewDueAt: null, supervisorReviewDueAt: null,
    supportCase: { state: "not_applicable", newRequestRequired: false, expiredRequestMayReleaseAccount: false },
    supportEscalation: {
      required: false, target: null, automaticAccountReleaseAllowed: false,
      notifications: { supervisor: [], courier: [], courierStatus: null },
    },
    renewalNotice: { due: false, channels: ["courier_app", "email"], placement: "courier_deliveries_area" },
    courierAreaStatus: { state: "eligible", pendingActions: [] },
    manualOverrideAllowed: false, documentExposureAllowed: false,
  });
});

test("police clearance follows the verified issuer validity instead of an artificial renewal period", () => {
  const current = courierEligibility(complete, { now });
  assert.equal(current.eligible, true);
  const expired = courierEligibility({
    ...complete,
    policeClearance: { ...complete.policeClearance, expiresAt: "2030-01-01T12:00:00Z" },
  }, { now });
  assert.ok(expired.blockers.includes("courier_police_clearance_invalid"));
  const missingOfficialValidity = courierEligibility({
    ...complete,
    policeClearance: { ...complete.policeClearance, validitySource: null },
  }, { now });
  assert.ok(missingOfficialValidity.blockers.includes("courier_police_clearance_invalid"));
});

test("police clearance requires an auditable administrative check through the official channel", () => {
  const missingReview = courierEligibility({
    ...complete,
    policeClearance: { ...complete.policeClearance, review: null },
  }, { now });
  assert.ok(missingReview.blockers.includes("courier_police_clearance_invalid"));

  const externalSupplier = courierEligibility({
    ...complete,
    policeClearance: {
      ...complete.policeClearance,
      review: { ...complete.policeClearance.review, method: "external_background_check_supplier" },
    },
  }, { now });
  assert.ok(externalSupplier.blockers.includes("courier_police_clearance_invalid"));

  const futureReview = courierEligibility({
    ...complete,
    policeClearance: {
      ...complete.policeClearance,
      review: { ...complete.policeClearance.review, verifiedAt: "2030-01-01T12:00:00.001Z" },
    },
  }, { now });
  assert.ok(futureReview.blockers.includes("courier_police_clearance_invalid"));
});

test("retained police clearance copy requires encrypted restricted storage and an approved deletion deadline", () => {
  const scenarios = [
    { storage: null },
    { storage: { ...complete.policeClearance.storage, encryptionStatus: "plaintext" } },
    { storage: { ...complete.policeClearance.storage, accessScope: "all_admins" } },
    { storage: { ...complete.policeClearance.storage, accessLoggingEnabled: false } },
    { storage: { ...complete.policeClearance.storage, retention: { ...complete.policeClearance.storage.retention, status: "awaiting_review" } } },
    { storage: { ...complete.policeClearance.storage, retention: { ...complete.policeClearance.storage.retention, deleteAt: "2030-01-01T12:00:00Z" } } },
    { storage: { ...complete.policeClearance.storage, retention: { ...complete.policeClearance.storage.retention, deleteAt: "2031-02-02T00:00:00Z" } } },
  ];
  for (const change of scenarios) {
    const result = courierEligibility({
      ...complete,
      policeClearance: { ...complete.policeClearance, ...change },
    }, { now });
    assert.ok(result.blockers.includes("courier_police_clearance_invalid"));
  }
});

test("the retained copy is scheduled for deletion exactly thirty days after issuer expiry", () => {
  const result = courierEligibility(complete, { now });
  assert.equal(result.eligible, true);
  assert.equal(
    Date.parse(complete.policeClearance.storage.retention.deleteAt),
    Date.parse(complete.policeClearance.expiresAt) + (30 * 24 * 60 * 60 * 1000),
  );
});

test("renewal notice is due only during the final seven days without blocking an otherwise eligible courier", () => {
  const eightDaysBefore = Date.parse("2030-12-24T00:00:00Z");
  const sevenDaysBefore = Date.parse("2030-12-25T00:00:00Z");
  assert.equal(courierEligibility(complete, { now: eightDaysBefore }).policeClearanceRenewalNoticeDue, false);

  const notice = courierEligibility(complete, { now: sevenDaysBefore });
  assert.equal(notice.eligible, true);
  assert.equal(notice.mayReceiveOffers, true);
  assert.equal(notice.policeClearanceRenewalNoticeDue, true);
  assert.deepEqual(notice.renewalNotice, {
    due: true, channels: ["courier_app", "email"], placement: "courier_deliveries_area",
  });

  const expired = courierEligibility(complete, { now: Date.parse("2031-01-01T00:00:00Z") });
  assert.equal(expired.eligible, false);
  assert.equal(expired.mayReceiveOffers, false);
  assert.equal(expired.policeClearanceRenewalNoticeDue, false);
});

test("courier deliveries area explains every blocker and the required regularization", () => {
  const blocked = courierEligibility({
    ...complete,
    phoneVerified: false,
    policeClearance: { ...complete.policeClearance, status: "expired" },
  }, { now });
  assert.deepEqual(blocked.courierAreaStatus, {
    state: "blocked",
    pendingActions: [
      { blocker: "courier_contacts_not_verified", action: "verify_email_and_phone" },
      { blocker: "courier_police_clearance_invalid", action: "renew_or_verify_police_clearance" },
    ],
  });
  assert.equal(blocked.documentExposureAllowed, false);
});

test("police clearance expiry blocks only new offers and preserves active delivery and earned payment", () => {
  const effects = policeClearanceExpiryEffects({
    ...complete,
    policeClearance: { ...complete.policeClearance, status: "expired" },
  }, { now });
  assert.deepEqual(effects, {
    expired: true,
    newOffersBlocked: true,
    activeDeliveryCompletionAllowed: true,
    earnedPaymentObligationPreserved: true,
    expiryAloneBlocksEarnedPayout: false,
    ordinaryFinancialValidationStillRequired: true,
  });
});

test("a valid police clearance has no expiry restriction", () => {
  const effects = policeClearanceExpiryEffects(complete, { now });
  assert.equal(effects.expired, false);
  assert.equal(effects.newOffersBlocked, false);
});

test("previously approved courier has a strict twenty-four-hour provisional renewal window", () => {
  const submittedAt = "2030-01-01T10:00:00Z";
  const pendingRenewal = {
    ...complete,
    policeClearance: {
      status: "renewal_pending_review",
      previousVerification: { status: "verified", verificationReference: "clearance-previous-1" },
      renewal: {
        complete: true, submissionReference: "renewal-submission-1",
        submittedAt, reviewDueAt: "2030-01-02T10:00:00Z",
      },
    },
  };
  const duringWindow = courierEligibility(pendingRenewal, { now });
  assert.equal(duringWindow.eligible, true);
  assert.equal(duringWindow.mayReceiveOffers, true);
  assert.equal(duringWindow.policeClearanceProvisional, true);
  assert.equal(duringWindow.administrativeReviewDueAt, "2030-01-02T10:00:00.000Z");

  const atDeadline = courierEligibility(pendingRenewal, { now: Date.parse("2030-01-02T10:00:00Z") });
  assert.equal(atDeadline.eligible, false);
  assert.equal(atDeadline.mayReceiveOffers, false);
  assert.ok(atDeadline.blockers.includes("courier_police_clearance_invalid"));
});

test("new courier or incomplete renewal never receives provisional clearance", () => {
  const renewal = {
    complete: true, submissionReference: "renewal-submission-1",
    submittedAt: "2030-01-01T10:00:00Z", reviewDueAt: "2030-01-02T10:00:00Z",
  };
  const newCourier = courierEligibility({
    ...complete,
    policeClearance: { status: "renewal_pending_review", renewal },
  }, { now });
  assert.equal(newCourier.policeClearanceProvisional, false);
  assert.equal(newCourier.eligible, false);

  const incomplete = courierEligibility({
    ...complete,
    policeClearance: {
      status: "renewal_pending_review",
      previousVerification: { status: "verified", verificationReference: "clearance-previous-1" },
      renewal: { ...renewal, complete: false },
    },
  }, { now });
  assert.equal(incomplete.eligible, false);
});

test("rejected renewal blocks new offers but preserves active delivery and earned payment", () => {
  const effects = policeClearanceRejectionEffects({
    ...complete,
    policeClearance: { status: "renewal_rejected" },
  });
  assert.deepEqual(effects, {
    rejected: true,
    newOffersBlocked: true,
    activeDeliveryCompletionAllowed: true,
    earnedPaymentObligationPreserved: true,
    rejectionAloneBlocksEarnedPayout: false,
    suspectedFraudRequiresSupportReview: true,
    automaticCancellationAllowed: false,
    automaticPayoutRetentionAllowed: false,
  });
});

test("corrected resubmission after rejection stays suspended until auditable support release", () => {
  const corrected = {
    ...complete,
    policeClearance: {
      status: "renewal_pending_review",
      previousVerification: { status: "verified", verificationReference: "clearance-previous-1" },
      previousReviewOutcome: "rejected",
      renewal: {
        complete: true, submissionReference: "corrected-renewal-1",
        submittedAt: "2030-01-01T10:00:00Z", reviewDueAt: "2030-01-02T10:00:00Z",
      },
    },
    clearanceSuspension: {
      reason: "renewal_rejected",
      supportRequest: {
        requestReference: "support-request-1", openedAt: "2030-01-01T11:00:00Z",
        dueAt: "2030-01-02T11:00:00Z",
      },
      supportRelease: { status: "pending" },
    },
  };
  const suspended = courierEligibility(corrected, { now });
  assert.equal(suspended.eligible, false);
  assert.equal(suspended.policeClearanceProvisional, false);
  assert.ok(suspended.blockers.includes("courier_support_release_required"));
  assert.ok(suspended.courierAreaStatus.pendingActions.some(({ action }) =>
    action === "contact_support_for_clearance_release"));
  assert.equal(suspended.supportReviewDueAt, "2030-01-02T11:00:00.000Z");
  assert.equal(suspended.supervisorReviewDueAt, "2030-01-03T11:00:00.000Z");
});

test("support release must be approved, identified and auditable", () => {
  const approved = courierEligibility({
    ...complete,
    clearanceSuspension: {
      reason: "renewal_rejected",
      supportRequest: {
        requestReference: "support-request-1", openedAt: "2029-12-31T10:00:00Z",
        dueAt: "2030-01-01T10:00:00Z",
      },
      supportRelease: {
        status: "approved", reviewerId: "support-1", auditReference: "support-release-1",
        decidedAt: "2029-12-31T12:00:00Z",
      },
    },
  }, { now });
  assert.equal(approved.eligible, true);
  assert.ok(!approved.blockers.includes("courier_support_release_required"));

  const unaudited = courierEligibility({
    ...complete,
    clearanceSuspension: {
      reason: "renewal_rejected",
      supportRequest: {
        requestReference: "support-request-1", openedAt: "2029-12-31T10:00:00Z",
        dueAt: "2030-01-01T10:00:00Z",
      },
      supportRelease: { status: "approved", reviewerId: "support-1", decidedAt: "2029-12-31T12:00:00Z" },
    },
  }, { now });
  assert.ok(unaudited.blockers.includes("courier_support_release_required"));
});

test("support release after corrected approval must be decided within twenty-four hours", () => {
  const late = courierEligibility({
    ...complete,
    clearanceSuspension: {
      reason: "renewal_rejected",
      supportRequest: {
        requestReference: "support-request-late", openedAt: "2029-12-30T10:00:00Z",
        dueAt: "2029-12-31T10:00:00Z",
      },
      supportRelease: {
        status: "approved", reviewerId: "support-1", auditReference: "support-release-late",
        decidedAt: "2029-12-31T10:00:00.001Z",
      },
    },
  }, { now });
  assert.equal(late.eligible, false);
  assert.ok(late.blockers.includes("courier_support_release_required"));
  assert.deepEqual(late.supportEscalation, {
    required: false,
    target: null,
    automaticAccountReleaseAllowed: false,
    notifications: {
      supervisor: [],
      courier: [],
      courierStatus: null,
    },
  });
  assert.equal(late.supportCase.state, "closed_sla_expired");
});

test("pending support request escalates at the deadline while the courier remains suspended", () => {
  const atDeadline = courierEligibility({
    ...complete,
    clearanceSuspension: {
      reason: "renewal_rejected",
      supportRequest: {
        requestReference: "support-request-pending", openedAt: "2029-12-31T12:00:00Z",
        dueAt: "2030-01-01T12:00:00Z",
      },
      supportRelease: { status: "pending" },
    },
  }, { now });
  assert.equal(atDeadline.eligible, false);
  assert.equal(atDeadline.mayReceiveOffers, false);
  assert.deepEqual(atDeadline.supportEscalation, {
    required: true,
    target: "support_supervisor",
    automaticAccountReleaseAllowed: false,
    notifications: {
      supervisor: ["support_dashboard", "email"],
      courier: ["courier_app", "email"],
      courierStatus: "priority_review",
    },
  });
});

test("identified supervisor may release within the additional twenty-four-hour escalation window", () => {
  const supervised = courierEligibility({
    ...complete,
    clearanceSuspension: {
      reason: "renewal_rejected",
      supportRequest: {
        requestReference: "support-request-supervised", openedAt: "2029-12-30T10:00:00Z",
        dueAt: "2029-12-31T10:00:00Z",
      },
      supportRelease: {
        status: "approved", reviewerId: "supervisor-1", reviewerRole: "support_supervisor",
        auditReference: "supervisor-release-1", decidedAt: "2030-01-01T09:59:59Z",
      },
    },
  }, { now });
  assert.equal(supervised.eligible, true);
  assert.ok(!supervised.blockers.includes("courier_support_release_required"));
});

test("supervisor decision after its additional twenty-four-hour window does not reactivate", () => {
  const tooLate = courierEligibility({
    ...complete,
    clearanceSuspension: {
      reason: "renewal_rejected",
      supportRequest: {
        requestReference: "support-request-supervised-late", openedAt: "2029-12-29T10:00:00Z",
        dueAt: "2029-12-30T10:00:00Z",
      },
      supportRelease: {
        status: "approved", reviewerId: "supervisor-1", reviewerRole: "support_supervisor",
        auditReference: "supervisor-release-late", decidedAt: "2029-12-31T10:00:00.001Z",
      },
    },
  }, { now });
  assert.equal(tooLate.eligible, false);
  assert.ok(tooLate.blockers.includes("courier_support_release_required"));
  assert.deepEqual(tooLate.supportCase, {
    state: "closed_sla_expired",
    newRequestRequired: true,
    expiredRequestMayReleaseAccount: false,
  });
  assert.equal(tooLate.supportEscalation.required, false);
});

test("unanswered case closes after the supervisor deadline and requires a new request", () => {
  const closed = courierEligibility({
    ...complete,
    clearanceSuspension: {
      reason: "renewal_rejected",
      supportRequest: {
        requestReference: "support-request-unanswered", openedAt: "2029-12-29T10:00:00Z",
        dueAt: "2029-12-30T10:00:00Z",
      },
      supportRelease: { status: "pending" },
    },
  }, { now });
  assert.equal(closed.eligible, false);
  assert.deepEqual(closed.supportCase, {
    state: "closed_sla_expired",
    newRequestRequired: true,
    expiredRequestMayReleaseAccount: false,
  });
});

test("each mandatory onboarding gate fails closed without admin override", () => {
  const scenarios = [
    [{ accountActive: false }, "courier_account_inactive"],
    [{ identityStatus: "pending" }, "courier_identity_not_verified"],
    [{ adultConfirmed: false }, "courier_adult_declaration_required"],
    [{ phoneVerified: false }, "courier_contacts_not_verified"],
    [{ vehicle: { type: "motorcycle", approved: false } }, "courier_vehicle_not_approved"],
    [{ driverLicense: { status: "verified", expiresAt: "2030-01-01T12:00:00Z" } }, "courier_driver_license_invalid"],
    [{ payoutAccount: { status: "pending" } }, "courier_payout_account_not_verified"],
    [{ policeClearance: { status: "pending" } }, "courier_police_clearance_invalid"],
    [{ terms: { version: "old", accepted: true } }, "courier_terms_not_accepted"],
    [{ adminApproval: { status: "pending" } }, "courier_admin_approval_required"],
  ];
  for (const [change, blocker] of scenarios) {
    const result = courierEligibility({ ...complete, ...change }, { now });
    assert.equal(result.eligible, false);
    assert.equal(result.mayReceiveOffers, false);
    assert.equal(result.manualOverrideAllowed, false);
    assert.ok(result.blockers.includes(blocker));
  }
});

test("non-motorized approved vehicle does not require a driver license", () => {
  const result = courierEligibility({ ...complete, vehicle: { type: "bicycle", approved: true }, driverLicense: null }, { now });
  assert.equal(result.eligible, true);
  assert.ok(!result.blockers.includes("courier_driver_license_invalid"));
});

test("pilot allows motorcycle and bicycle, but bicycle only up to five kilometers", () => {
  assert.deepEqual(PILOT_COURIER_VEHICLES, ["motorcycle", "bicycle"]);
  const bicycle = { ...complete, vehicle: { type: "bicycle", approved: true }, driverLicense: null };
  assert.equal(courierEligibility(bicycle, { now, distanceKm: 5 }).eligible, true);
  const outside = courierEligibility(bicycle, { now, distanceKm: 5.001 });
  assert.equal(outside.eligible, false);
  assert.ok(outside.blockers.includes("bicycle_route_outside_coverage"));
  assert.ok(courierEligibility({ ...complete, vehicle: { type: "car", approved: true } }, { now }).blockers.includes("courier_vehicle_not_approved"));
});
