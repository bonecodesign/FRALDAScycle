import { createHash } from "node:crypto";

const PROVIDERS = new Set(["google-maps", "viacep"]);

export function normalizeBrazilianPostalCode(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(digits) || /^(\d)\1{7}$/.test(digits)) {
    throw Object.assign(new Error("Invalid Brazilian postal code"), { code: "invalid_postal_code" });
  }
  return digits;
}

function normalizedPlace(value) {
  return String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export function verifyPostalCodeEvidence(address, evidence) {
  const blockers = [];
  let claimedPostalCode;
  let providerPostalCode;
  try { claimedPostalCode = normalizeBrazilianPostalCode(address?.postalCode ?? address?.postal_code); }
  catch { blockers.push("invalid_postal_code"); }
  try { providerPostalCode = normalizeBrazilianPostalCode(evidence?.postalCode ?? evidence?.postal_code); }
  catch { blockers.push("provider_postal_code_missing"); }
  const addressVersion = Number(address?.version);
  const evidenceVersion = Number(evidence?.addressVersion);
  if (!Number.isSafeInteger(addressVersion) || addressVersion < 1 || evidenceVersion !== addressVersion) {
    blockers.push("address_version_mismatch");
  }
  if (!PROVIDERS.has(evidence?.provider) || !String(evidence?.placeId ?? "").trim()) {
    blockers.push("postal_provider_unverified");
  }
  if (evidence?.partialMatch === true || evidence?.exactMatch !== true) blockers.push("postal_match_not_exact");
  if (claimedPostalCode && providerPostalCode && claimedPostalCode !== providerPostalCode) blockers.push("postal_code_mismatch");
  if (normalizedPlace(address?.city) !== normalizedPlace(evidence?.city)
      || String(address?.state ?? "").trim().toUpperCase() !== String(evidence?.state ?? "").trim().toUpperCase()) {
    blockers.push("postal_locality_mismatch");
  }
  const unique = Object.freeze([...new Set(blockers)]);
  if (unique.length) return Object.freeze({ verified: false, blockers: unique, verificationFingerprint: null });
  const verificationFingerprint = createHash("sha256").update(JSON.stringify({
    addressId: String(address.id ?? ""), addressVersion, postalCode: claimedPostalCode,
    city: normalizedPlace(address.city), state: String(address.state).toUpperCase(),
    provider: evidence.provider, placeId: String(evidence.placeId),
  })).digest("base64url");
  return Object.freeze({ verified: true, blockers: unique, verificationFingerprint,
    postalCode: claimedPostalCode, provider: evidence.provider, addressVersion });
}

export function requireVerifiedPostalCode(address, evidence) {
  const result = verifyPostalCodeEvidence(address, evidence);
  if (!result.verified) throw Object.assign(new Error("O CEP precisa ser confirmado novamente."), {
    code: result.blockers[0] ?? "postal_verification_required", status: 422, blockers: result.blockers,
  });
  return result;
}
