import { createHash } from "node:crypto";

const ACTIVE_STATES = new Set(["review", "published", "paused"]);
const HASH = /^[0-9a-f]{64}$/i;

function normalized(value) {
  return String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

function listingIdentity(listing) {
  const mediaHashes = Array.isArray(listing?.mediaHashes)
    ? [...new Set(listing.mediaHashes.map(value => String(value).toLowerCase()).filter(value => HASH.test(value)))].sort()
    : [];
  const core = {
    category: normalized(listing?.category), brand: normalized(listing?.brand), model: normalized(listing?.model),
    size: normalized(listing?.size), packageCondition: normalized(listing?.packageCondition ?? listing?.package_condition),
    kind: normalized(listing?.kind),
  };
  if (Object.values(core).some(value => !value) || mediaHashes.length < 1) {
    throw Object.assign(new Error("Insufficient duplicate evidence"), { code: "listing_duplicate_evidence_incomplete" });
  }
  return { core, mediaHashes };
}

const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("base64url");

export function listingDuplicateFingerprints(listing) {
  const { core, mediaHashes } = listingIdentity(listing);
  return Object.freeze({
    productFingerprint: digest(core),
    mediaFingerprint: digest(mediaHashes),
    exactFingerprint: digest({ ...core, mediaHashes }),
  });
}

export function assessListingDuplicate(candidate, existing = []) {
  let fingerprints;
  try { fingerprints = listingDuplicateFingerprints(candidate); }
  catch (error) { return Object.freeze({ action: "review", blocker: error.code, matches: Object.freeze([]) }); }
  const matches = [];
  for (const listing of Array.isArray(existing) ? existing : []) {
    if (!ACTIVE_STATES.has(listing?.status) || listing?.id === candidate?.id) continue;
    let other;
    try { other = listingDuplicateFingerprints(listing); } catch { continue; }
    if (other.exactFingerprint !== fingerprints.exactFingerprint) continue;
    matches.push(Object.freeze({ id: String(listing.id), sameOwner: listing.sellerId === candidate.sellerId,
      status: listing.status }));
  }
  const sameOwner = matches.some(match => match.sameOwner);
  return Object.freeze({
    action: sameOwner ? "block" : matches.length ? "review" : "allow",
    blocker: sameOwner ? "active_listing_duplicate" : matches.length ? "shared_media_duplicate_review" : null,
    matches: Object.freeze(matches),
    fingerprints,
    premiumBypassAllowed: false,
  });
}
