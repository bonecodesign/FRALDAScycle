import assert from "node:assert/strict";
import test from "node:test";
import {
  MARKETPLACE_RANKING_WEIGHTS,
  balancedProfileCompatibility,
  marketplaceDistanceBand,
  marketplaceRankingMode,
  personalizedMarketplaceScore,
  rankPersonalizedMarketplace,
} from "../packages/contracts/marketplace-ranking.js";

test("ranking gives exactly equal weight to age compatibility and distance", () => {
  assert.deepEqual(MARKETPLACE_RANKING_WEIGHTS, { ageCompatibility: 0.5, distanceBand: 0.5 });
  assert.deepEqual(personalizedMarketplaceScore({ profileScores: [1], distanceKm: 15 }), {
    ready: true, blocker: null, score: 0.833333, ageScore: 1,
    distanceScore: 2 / 3, distanceBand: "from_5_to_15_km",
  });
});

test("all profiles contribute equally and compatibility with several profiles gains relevance", () => {
  assert.equal(balancedProfileCompatibility([1, 0]), 0.5);
  assert.equal(balancedProfileCompatibility([1, 1]), 1);
  const one = personalizedMarketplaceScore({ profileScores: [1, 0], distanceKm: 5 });
  const both = personalizedMarketplaceScore({ profileScores: [1, 1], distanceKm: 5 });
  assert.ok(both.score > one.score);
});

test("distance bands are discrete and never hide distant products", () => {
  assert.equal(marketplaceDistanceBand(5).id, "up_to_5_km");
  assert.equal(marketplaceDistanceBand(5.01).id, "from_5_to_15_km");
  assert.equal(marketplaceDistanceBand(15.01).id, "from_15_to_30_km");
  assert.equal(marketplaceDistanceBand(300).id, "above_30_km");
  assert.equal(personalizedMarketplaceScore({ profileScores: [0], distanceKm: 300 }).ready, true);
});

test("quality and recency only break equal organic scores", () => {
  const ranked = rankPersonalizedMarketplace([
    { id: "older-high-quality", profileScores: [1], distanceKm: 5, qualityScore: 1, publishedAt: "2026-01-01T00:00:00Z" },
    { id: "newer-low-quality", profileScores: [1], distanceKm: 5, qualityScore: 0.5, publishedAt: "2026-10-01T00:00:00Z" },
    { id: "lower-score", profileScores: [0], distanceKm: 5, qualityScore: 1, publishedAt: "2026-12-01T00:00:00Z" },
  ]);
  assert.deepEqual(ranked.map(item => item.id), ["older-high-quality", "newer-low-quality", "lower-score"]);
});

test("manual ordering and disabled personalization never read profiles", () => {
  assert.deepEqual(marketplaceRankingMode({ manualSort: "lowest_price", personalizationEnabled: true }),
    { mode: "manual", readsProfiles: false });
  assert.deepEqual(marketplaceRankingMode({ personalizationEnabled: false }),
    { mode: "general_relevance", readsProfiles: false });
  assert.deepEqual(marketplaceRankingMode({ personalizationEnabled: true }),
    { mode: "personalized_relevance", readsProfiles: true });
});

test("missing official age guidance receives no age priority but remains rankable", () => {
  const result = personalizedMarketplaceScore({ profileScores: [], distanceKm: 4 });
  assert.equal(result.ready, true);
  assert.equal(result.ageScore, 0);
  assert.equal(result.score, 0.5);
  assert.equal(personalizedMarketplaceScore({ profileScores: [1], distanceKm: null }).ready, false);
});
