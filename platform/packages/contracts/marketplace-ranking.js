export const MARKETPLACE_RANKING_WEIGHTS = Object.freeze({
  ageCompatibility: 0.5,
  distanceBand: 0.5,
});

export const MARKETPLACE_DISTANCE_BANDS = Object.freeze([
  Object.freeze({ id: "up_to_5_km", maxKm: 5, score: 1 }),
  Object.freeze({ id: "from_5_to_15_km", maxKm: 15, score: 2 / 3 }),
  Object.freeze({ id: "from_15_to_30_km", maxKm: 30, score: 1 / 3 }),
  Object.freeze({ id: "above_30_km", maxKm: Infinity, score: 0 }),
]);

function boundedScore(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0;
}

export function balancedProfileCompatibility(profileScores) {
  if (!Array.isArray(profileScores) || profileScores.length === 0) return 0;
  return profileScores.reduce((total, score) => total + boundedScore(score), 0) / profileScores.length;
}

export function marketplaceDistanceBand(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return null;
  return MARKETPLACE_DISTANCE_BANDS.find(band => distanceKm <= band.maxKm);
}

export function personalizedMarketplaceScore({ profileScores, distanceKm }) {
  const distanceBand = marketplaceDistanceBand(distanceKm);
  if (!distanceBand) return Object.freeze({ ready: false, blocker: "distance_unavailable" });
  const ageScore = balancedProfileCompatibility(profileScores);
  const total = MARKETPLACE_RANKING_WEIGHTS.ageCompatibility * ageScore
    + MARKETPLACE_RANKING_WEIGHTS.distanceBand * distanceBand.score;
  return Object.freeze({
    ready: true,
    blocker: null,
    score: Math.round(total * 1_000_000) / 1_000_000,
    ageScore: Math.round(ageScore * 1_000_000) / 1_000_000,
    distanceScore: distanceBand.score,
    distanceBand: distanceBand.id,
  });
}

function time(value) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function rankPersonalizedMarketplace(listings) {
  if (!Array.isArray(listings)) throw new TypeError("Listings must be an array");
  return Object.freeze(listings.map(listing => Object.freeze({
    ...listing,
    ranking: personalizedMarketplaceScore(listing),
  })).sort((left, right) => {
    const score = Number(right.ranking.ready) * right.ranking.score
      - Number(left.ranking.ready) * left.ranking.score;
    if (score !== 0) return score;
    const quality = boundedScore(right.qualityScore) - boundedScore(left.qualityScore);
    if (quality !== 0) return quality;
    const recency = time(right.publishedAt) - time(left.publishedAt);
    if (recency !== 0) return recency;
    return String(left.id).localeCompare(String(right.id));
  }));
}

export function marketplaceRankingMode({ manualSort = null, personalizationEnabled = false } = {}) {
  if (manualSort) return Object.freeze({ mode: "manual", readsProfiles: false });
  if (!personalizationEnabled) return Object.freeze({ mode: "general_relevance", readsProfiles: false });
  return Object.freeze({ mode: "personalized_relevance", readsProfiles: true });
}
