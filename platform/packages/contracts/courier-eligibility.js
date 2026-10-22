const MOTORIZED_VEHICLES = new Set(["motorcycle", "car", "van"]);
const CLEARANCE_COPY_RETENTION_AFTER_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
const CLEARANCE_RENEWAL_NOTICE_BEFORE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const CLEARANCE_PROVISIONAL_REVIEW_SLA_MS = 24 * 60 * 60 * 1000;
export const PILOT_COURIER_VEHICLES = Object.freeze(["motorcycle", "bicycle"]);

const BLOCKER_ACTIONS = Object.freeze({
  courier_account_inactive: "reactivate_courier_account",
  courier_identity_not_verified: "verify_identity",
  courier_adult_declaration_required: "confirm_adult_status",
  courier_contacts_not_verified: "verify_email_and_phone",
  courier_vehicle_not_approved: "submit_eligible_vehicle",
  bicycle_route_outside_coverage: "select_route_within_bicycle_coverage",
  courier_driver_license_invalid: "renew_or_verify_driver_license",
  courier_payout_account_not_verified: "verify_payout_account",
  courier_police_clearance_invalid: "renew_or_verify_police_clearance",
  courier_support_release_required: "contact_support_for_clearance_release",
  courier_terms_not_accepted: "accept_current_courier_terms",
  courier_admin_approval_required: "await_administrative_approval",
});

export function policeClearanceExpiryEffects(profile, { now = Date.now() } = {}) {
  const expiresAt = Date.parse(profile?.policeClearance?.expiresAt ?? "");
  const expired = profile?.policeClearance?.status === "expired" ||
    (Number.isFinite(expiresAt) && expiresAt <= now);
  return Object.freeze({
    expired,
    newOffersBlocked: expired,
    activeDeliveryCompletionAllowed: true,
    earnedPaymentObligationPreserved: true,
    expiryAloneBlocksEarnedPayout: false,
    ordinaryFinancialValidationStillRequired: true,
  });
}

export function policeClearanceRejectionEffects(profile) {
  const rejected = profile?.policeClearance?.status === "renewal_rejected";
  return Object.freeze({
    rejected,
    newOffersBlocked: rejected,
    activeDeliveryCompletionAllowed: true,
    earnedPaymentObligationPreserved: true,
    rejectionAloneBlocksEarnedPayout: false,
    suspectedFraudRequiresSupportReview: rejected,
    automaticCancellationAllowed: false,
    automaticPayoutRetentionAllowed: false,
  });
}

export function courierEligibility(profile, { now = Date.now(), distanceKm = null } = {}) {
  const blockers = [];
  if (profile?.accountActive !== true) blockers.push("courier_account_inactive");
  if (profile?.identityStatus !== "verified") blockers.push("courier_identity_not_verified");
  if (profile?.adultConfirmed !== true) blockers.push("courier_adult_declaration_required");
  if (profile?.emailVerified !== true || profile?.phoneVerified !== true) blockers.push("courier_contacts_not_verified");
  if (!PILOT_COURIER_VEHICLES.includes(profile?.vehicle?.type) || profile.vehicle.approved !== true) blockers.push("courier_vehicle_not_approved");
  if (profile?.vehicle?.type === "bicycle" && distanceKm != null &&
      (!Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm > 5)) blockers.push("bicycle_route_outside_coverage");

  if (MOTORIZED_VEHICLES.has(profile?.vehicle?.type)) {
    const expiresAt = Date.parse(profile?.driverLicense?.expiresAt ?? "");
    if (profile?.driverLicense?.status !== "verified" || !Number.isFinite(expiresAt) || expiresAt <= now) {
      blockers.push("courier_driver_license_invalid");
    }
  }

  if (profile?.payoutAccount?.status !== "verified" || !profile?.payoutAccount?.providerReference) {
    blockers.push("courier_payout_account_not_verified");
  }
  const clearanceIssuedAt = Date.parse(profile?.policeClearance?.issuedAt ?? "");
  const clearanceExpiresAt = Date.parse(profile?.policeClearance?.expiresAt ?? "");
  const clearanceVerifiedAt = Date.parse(profile?.policeClearance?.review?.verifiedAt ?? "");
  const clearanceRetentionDeleteAt = Date.parse(profile?.policeClearance?.storage?.retention?.deleteAt ?? "");
  const clearanceVerifiedAndValid = profile?.policeClearance?.status === "verified" &&
    profile?.policeClearance?.issuer === "police_civil";
  const verifiedClearanceRequirementsMet = clearanceVerifiedAndValid &&
    profile?.policeClearance?.validitySource === "issuer_document" &&
    Boolean(profile?.policeClearance?.verificationReference) && Number.isFinite(clearanceIssuedAt) && clearanceIssuedAt <= now &&
    Number.isFinite(clearanceExpiresAt) && clearanceExpiresAt > now && clearanceExpiresAt > clearanceIssuedAt &&
    profile?.policeClearance?.review?.method === "official_police_civil_channel" &&
    Boolean(profile?.policeClearance?.review?.reviewerId) && Boolean(profile?.policeClearance?.review?.auditReference) &&
    Number.isFinite(clearanceVerifiedAt) && clearanceVerifiedAt <= now && clearanceVerifiedAt >= clearanceIssuedAt &&
    profile?.policeClearance?.storage?.mode === "encrypted_restricted" &&
    profile?.policeClearance?.storage?.encryptionStatus === "encrypted" &&
    Boolean(profile?.policeClearance?.storage?.storageReference) && Boolean(profile?.policeClearance?.storage?.keyReference) &&
    profile?.policeClearance?.storage?.accessScope === "courier_clearance_reviewers" &&
    profile?.policeClearance?.storage?.accessLoggingEnabled === true &&
    profile?.policeClearance?.storage?.retention?.status === "approved" &&
    Boolean(profile?.policeClearance?.storage?.retention?.policyVersion) &&
    Boolean(profile?.policeClearance?.storage?.retention?.legalApproverId) &&
    Number.isFinite(clearanceRetentionDeleteAt) && clearanceRetentionDeleteAt > now &&
    clearanceRetentionDeleteAt === clearanceExpiresAt + CLEARANCE_COPY_RETENTION_AFTER_EXPIRY_MS;
  const renewalSubmittedAt = Date.parse(profile?.policeClearance?.renewal?.submittedAt ?? "");
  const renewalReviewDueAt = Date.parse(profile?.policeClearance?.renewal?.reviewDueAt ?? "");
  const provisionalRenewalAllowed = profile?.policeClearance?.status === "renewal_pending_review" &&
    profile?.policeClearance?.previousVerification?.status === "verified" &&
    profile?.policeClearance?.previousReviewOutcome !== "rejected" &&
    Boolean(profile?.policeClearance?.previousVerification?.verificationReference) &&
    profile?.policeClearance?.renewal?.complete === true &&
    Boolean(profile?.policeClearance?.renewal?.submissionReference) &&
    Number.isFinite(renewalSubmittedAt) && renewalSubmittedAt <= now &&
    Number.isFinite(renewalReviewDueAt) && renewalReviewDueAt > now &&
    renewalReviewDueAt === renewalSubmittedAt + CLEARANCE_PROVISIONAL_REVIEW_SLA_MS;
  if (!verifiedClearanceRequirementsMet && !provisionalRenewalAllowed) {
    blockers.push("courier_police_clearance_invalid");
  }
  const rejectedClearanceSuspension = profile?.clearanceSuspension?.reason === "renewal_rejected";
  const supportRequestOpenedAt = Date.parse(profile?.clearanceSuspension?.supportRequest?.openedAt ?? "");
  const supportRequestDueAt = Date.parse(profile?.clearanceSuspension?.supportRequest?.dueAt ?? "");
  const supervisorReviewDueAt = supportRequestDueAt + CLEARANCE_PROVISIONAL_REVIEW_SLA_MS;
  const supportReleaseDecidedAt = Date.parse(profile?.clearanceSuspension?.supportRelease?.decidedAt ?? "");
  const supportRequestHasValidSla = Boolean(profile?.clearanceSuspension?.supportRequest?.requestReference) &&
    Number.isFinite(supportRequestOpenedAt) && supportRequestOpenedAt <= now &&
    Number.isFinite(supportRequestDueAt) &&
    supportRequestDueAt === supportRequestOpenedAt + CLEARANCE_PROVISIONAL_REVIEW_SLA_MS;
  const supportDecisionWithinInitialSla = supportRequestHasValidSla &&
    Number.isFinite(supportReleaseDecidedAt) &&
    supportReleaseDecidedAt >= supportRequestOpenedAt && supportReleaseDecidedAt <= supportRequestDueAt;
  const supervisorDecisionWithinEscalationSla = supportRequestHasValidSla &&
    profile?.clearanceSuspension?.supportRelease?.reviewerRole === "support_supervisor" &&
    Number.isFinite(supportReleaseDecidedAt) &&
    supportReleaseDecidedAt > supportRequestDueAt && supportReleaseDecidedAt <= supervisorReviewDueAt;
  const supportReleaseApproved = profile?.clearanceSuspension?.supportRelease?.status === "approved" &&
    Boolean(profile?.clearanceSuspension?.supportRelease?.reviewerId) &&
    Boolean(profile?.clearanceSuspension?.supportRelease?.auditReference) &&
    Number.isFinite(supportReleaseDecidedAt) && supportReleaseDecidedAt <= now &&
    (supportDecisionWithinInitialSla || supervisorDecisionWithinEscalationSla);
  const supervisorSlaExpired = rejectedClearanceSuspension && supportRequestHasValidSla &&
    !supportReleaseApproved && now > supervisorReviewDueAt;
  const supportEscalationRequired = rejectedClearanceSuspension && supportRequestHasValidSla &&
    !supportReleaseApproved && now >= supportRequestDueAt && !supervisorSlaExpired;
  if (rejectedClearanceSuspension && !supportReleaseApproved) {
    blockers.push("courier_support_release_required");
  }
  if (profile?.terms?.version !== "FC-COURIER-1" || profile?.terms?.accepted !== true) {
    blockers.push("courier_terms_not_accepted");
  }
  if (profile?.adminApproval?.status !== "approved" || !profile?.adminApproval?.reviewerId) {
    blockers.push("courier_admin_approval_required");
  }

  const policeClearanceRenewalNoticeDue = profile?.policeClearance?.status === "verified" &&
    Number.isFinite(clearanceExpiresAt) && clearanceExpiresAt > now &&
    clearanceExpiresAt - now <= CLEARANCE_RENEWAL_NOTICE_BEFORE_EXPIRY_MS;
  const pendingActions = Object.freeze(blockers.map((blocker) => Object.freeze({
    blocker,
    action: BLOCKER_ACTIONS[blocker],
  })));

  return Object.freeze({
    eligible: blockers.length === 0,
    blockers: Object.freeze(blockers),
    mayReceiveOffers: blockers.length === 0,
    policeClearanceRenewalNoticeDue,
    policeClearanceProvisional: provisionalRenewalAllowed,
    administrativeReviewDueAt: provisionalRenewalAllowed
      ? new Date(renewalReviewDueAt).toISOString()
      : null,
    supportReviewDueAt: rejectedClearanceSuspension && supportRequestHasValidSla
      ? new Date(supportRequestDueAt).toISOString()
      : null,
    supervisorReviewDueAt: rejectedClearanceSuspension && supportRequestHasValidSla
      ? new Date(supervisorReviewDueAt).toISOString()
      : null,
    supportCase: Object.freeze({
      state: supervisorSlaExpired
        ? "closed_sla_expired"
        : rejectedClearanceSuspension ? "open" : "not_applicable",
      newRequestRequired: supervisorSlaExpired,
      expiredRequestMayReleaseAccount: false,
    }),
    supportEscalation: Object.freeze({
      required: supportEscalationRequired,
      target: supportEscalationRequired ? "support_supervisor" : null,
      automaticAccountReleaseAllowed: false,
      notifications: Object.freeze({
        supervisor: supportEscalationRequired
          ? Object.freeze(["support_dashboard", "email"])
          : Object.freeze([]),
        courier: supportEscalationRequired
          ? Object.freeze(["courier_app", "email"])
          : Object.freeze([]),
        courierStatus: supportEscalationRequired ? "priority_review" : null,
      }),
    }),
    renewalNotice: Object.freeze({
      due: policeClearanceRenewalNoticeDue,
      channels: Object.freeze(["courier_app", "email"]),
      placement: "courier_deliveries_area",
    }),
    courierAreaStatus: Object.freeze({
      state: blockers.length === 0 ? "eligible" : "blocked",
      pendingActions,
    }),
    manualOverrideAllowed: false,
    documentExposureAllowed: false,
  });
}
