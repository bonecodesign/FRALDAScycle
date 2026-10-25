import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeBrazilianPostalCode,
  requireVerifiedPostalCode,
  verifyPostalCodeEvidence,
} from "../packages/contracts/postal-code-verification.js";

const address = Object.freeze({ id: "address-1", version: 3, postalCode: "30110-028",
  city: "Belo Horizonte", state: "MG" });
const evidence = Object.freeze({ provider: "google-maps", placeId: "place-1", addressVersion: 3,
  postalCode: "30110028", city: "Belo Horizonte", state: "MG", exactMatch: true, partialMatch: false });

test("Brazilian CEP is normalized and trivial fabricated formats are rejected", () => {
  assert.equal(normalizeBrazilianPostalCode("30110-028"), "30110028");
  for (const value of ["3011", "abcdefgh", "00000-000", "11.111-111"]) {
    assert.throws(() => normalizeBrazilianPostalCode(value), error => error.code === "invalid_postal_code");
  }
});

test("exact provider evidence for the same address version is accepted", () => {
  const result = requireVerifiedPostalCode(address, evidence);
  assert.equal(result.verified, true);
  assert.match(result.verificationFingerprint, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(result.postalCode, "30110028");
});

test("mismatch, partial result and address edits invalidate verification", () => {
  const scenarios = [
    [{ ...evidence, postalCode: "30120-010" }, "postal_code_mismatch"],
    [{ ...evidence, partialMatch: true }, "postal_match_not_exact"],
    [{ ...evidence, addressVersion: 2 }, "address_version_mismatch"],
    [{ ...evidence, city: "Contagem" }, "postal_locality_mismatch"],
    [{ ...evidence, placeId: "" }, "postal_provider_unverified"],
  ];
  for (const [changed, blocker] of scenarios) {
    const result = verifyPostalCodeEvidence(address, changed);
    assert.equal(result.verified, false);
    assert.ok(result.blockers.includes(blocker));
    assert.equal(result.verificationFingerprint, null);
  }
});

test("verification fingerprint changes with address identity and never contains raw address text", () => {
  const first = requireVerifiedPostalCode(address, evidence).verificationFingerprint;
  const second = requireVerifiedPostalCode({ ...address, id: "address-2" }, evidence).verificationFingerprint;
  assert.notEqual(first, second);
  assert.doesNotMatch(first, /30110|Belo|address/);
});
