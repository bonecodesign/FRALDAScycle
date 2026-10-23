const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePilotInvitationEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new TypeError("pilot_invitation_email_invalid");
  return email;
}

function instant(value, code) {
  const milliseconds = Date.parse(value ?? "");
  if (!Number.isFinite(milliseconds)) throw new TypeError(code);
  return milliseconds;
}

export function pilotInvitationIssuance(input, { now = Date.now() } = {}) {
  const email = normalizePilotInvitationEmail(input?.email);
  const expiresAt = instant(input?.expiresAt, "pilot_invitation_expiry_invalid");
  if (expiresAt <= now) throw new RangeError("pilot_invitation_expiry_not_future");
  const purpose = String(input?.purpose ?? "").trim();
  if (purpose.length < 10 || purpose.length > 240) throw new TypeError("pilot_invitation_purpose_invalid");
  return Object.freeze({ email, expiresAt: new Date(expiresAt).toISOString(), purpose });
}

export function pilotInvitationState(invitation, { now = Date.now() } = {}) {
  const expiresAt = instant(invitation?.expiresAt, "pilot_invitation_expiry_invalid");
  const consumedAt = invitation?.consumedAt == null ? null : instant(invitation.consumedAt, "pilot_invitation_consumed_at_invalid");
  const revokedAt = invitation?.revokedAt == null ? null : instant(invitation.revokedAt, "pilot_invitation_revoked_at_invalid");
  const state = revokedAt != null ? "revoked"
    : consumedAt != null ? "consumed"
      : expiresAt <= now ? "expired" : "issued";
  return Object.freeze({
    state,
    mayRegister: state === "issued",
    mayLogin: state === "issued" || state === "consumed",
    reusableForAnotherAccount: false,
    externalDeliveryClaimed: false,
  });
}

export function pilotInvitationAdmission(invitation, email, options) {
  if (!invitation || normalizePilotInvitationEmail(email) !== normalizePilotInvitationEmail(invitation.email)) {
    return Object.freeze({ admitted: false, reason: "pilot_invitation_required" });
  }
  const state = pilotInvitationState(invitation, options);
  return Object.freeze({
    admitted: state.mayRegister,
    reason: state.mayRegister ? null : `pilot_invitation_${state.state}`,
  });
}
