export const LISTING_QUALITY_WEIGHTS = Object.freeze({
  completeness: 0.4,
  photos: 0.3,
  catalogConsistency: 0.2,
  freshness: 0.1,
});

const REQUIRED_FIELDS = Object.freeze([
  "title", "description", "kind", "category", "brand", "model", "size",
  "quantity", "packageCondition", "city", "state",
]);

function value(listing, camel, snake = camel) {
  return listing?.[camel] ?? listing?.[snake];
}

function present(input) {
  if (typeof input === "string") return input.trim().length > 0;
  return input !== null && input !== undefined;
}

export function listingCompletenessScore(listing) {
  if (!listing || typeof listing !== "object" || Array.isArray(listing)) return 0;
  let complete = REQUIRED_FIELDS.reduce((total, field) => {
    const snake = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    return total + Number(present(value(listing, field, snake)));
  }, 0);
  let total = REQUIRED_FIELDS.length;
  if (value(listing, "kind") === "sale") {
    total += 1;
    complete += Number(Number.isInteger(value(listing, "priceCents", "price_cents"))
      && value(listing, "priceCents", "price_cents") >= 0);
  }
  return complete / total;
}

export function listingPhotoScore(listing) {
  const media = value(listing, "mediaKeys", "media_keys");
  const count = Array.isArray(media) ? new Set(media.filter(present)).size
    : Number(value(listing, "photoCount", "photo_count"));
  if (!Number.isFinite(count) || count < 1) return 0;
  if (count === 1) return 0.5;
  if (count === 2) return 0.75;
  return 1;
}

export function listingFreshnessScore(listing, now = new Date()) {
  const current = now instanceof Date ? now.getTime() : Date.parse(now);
  const changed = Date.parse(value(listing, "updatedAt", "updated_at")
    ?? value(listing, "publishedAt", "published_at") ?? "");
  if (!Number.isFinite(current) || !Number.isFinite(changed) || changed > current) return 0;
  const ageDays = (current - changed) / 86_400_000;
  if (ageDays <= 7) return 1;
  if (ageDays <= 30) return 0.75;
  if (ageDays <= 90) return 0.5;
  if (ageDays <= 180) return 0.25;
  return 0;
}

export function listingQualityScore(listing, { now = new Date() } = {}) {
  const dimensions = Object.freeze({
    completeness: listingCompletenessScore(listing),
    photos: listingPhotoScore(listing),
    catalogConsistency: value(listing, "officialCatalogMatch", "official_catalog_match") === true ? 1 : 0,
    freshness: listingFreshnessScore(listing, now),
  });
  const score = Object.entries(LISTING_QUALITY_WEIGHTS)
    .reduce((total, [dimension, weight]) => total + dimensions[dimension] * weight, 0);
  return Object.freeze({
    score: Math.round(score * 1_000_000) / 1_000_000,
    dimensions,
    policy: "objective_v1",
  });
}
