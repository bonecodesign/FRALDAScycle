import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePilotInvitationEmail,
  pilotInvitationAdmission,
  pilotInvitationIssuance,
  pilotInvitationState,
} from "../packages/contracts/pilot-invitation.js";

const now = Date.parse("2030-01-01T12:00:00Z");
const invitation = {
  email: "convidada@example.test",
  expiresAt: "2030-01-08T12:00:00Z",
  consumedAt: null,
  revokedAt: null,
};

test("pilot invitation issuance normalizes the address and requires an explicit future expiry", () => {
  assert.deepEqual(pilotInvitationIssuance({
    email: " Convidada@Example.Test ", expiresAt: invitation.expiresAt,
    purpose: "Acesso controlado ao piloto interno de Belo Horizonte.",
  }, { now }), {
    email: "convidada@example.test", expiresAt: "2030-01-08T12:00:00.000Z",
    purpose: "Acesso controlado ao piloto interno de Belo Horizonte.",
  });
  assert.throws(() => pilotInvitationIssuance({
    email: invitation.email, expiresAt: "2030-01-01T12:00:00Z", purpose: "Convite de piloto já expirado.",
  }, { now }), /expiry_not_future/);
  assert.throws(() => normalizePilotInvitationEmail("telefone-sem-email"), /email_invalid/);
});

test("only a matching issued invitation admits a new pilot registration", () => {
  assert.deepEqual(pilotInvitationAdmission(invitation, "CONVIDADA@example.test", { now }), {
    admitted: true, reason: null,
  });
  assert.deepEqual(pilotInvitationAdmission(invitation, "outra@example.test", { now }), {
    admitted: false, reason: "pilot_invitation_required",
  });
});

test("consumption is one-time while preserving login eligibility for the admitted account", () => {
  const consumed = { ...invitation, consumedAt: "2030-01-02T12:00:00Z" };
  assert.deepEqual(pilotInvitationState(consumed, { now: Date.parse("2030-01-03T12:00:00Z") }), {
    state: "consumed", mayRegister: false, mayLogin: true,
    reusableForAnotherAccount: false, externalDeliveryClaimed: false,
  });
  assert.deepEqual(pilotInvitationAdmission(consumed, invitation.email, { now }), {
    admitted: false, reason: "pilot_invitation_consumed",
  });
});

test("revocation has precedence and expiry fails closed", () => {
  assert.equal(pilotInvitationState({
    ...invitation, consumedAt: "2030-01-02T12:00:00Z", revokedAt: "2030-01-03T12:00:00Z",
  }, { now: Date.parse("2030-01-04T12:00:00Z") }).state, "revoked");
  assert.deepEqual(pilotInvitationAdmission(invitation, invitation.email, {
    now: Date.parse("2030-01-08T12:00:00Z"),
  }), { admitted: false, reason: "pilot_invitation_expired" });
});

test("the local contract never claims that a message or real invitation was delivered", () => {
  assert.equal(pilotInvitationState(invitation, { now }).externalDeliveryClaimed, false);
});
