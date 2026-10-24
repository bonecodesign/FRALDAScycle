import assert from "node:assert/strict";
import test from "node:test";
import {
  LISTING_QUALITY_WEIGHTS,
  listingCompletenessScore,
  listingFreshnessScore,
  listingPhotoScore,
  listingQualityScore,
} from "../packages/contracts/listing-quality-score.js";

const complete = Object.freeze({
  title: "Fralda Premium Care M", description: "Pacote fechado, armazenado em local seco.",
  kind: "sale", category: "infant", brand: "Pampers", model: "Premium Care", size: "M",
  quantity: 48, packageCondition: "sealed", city: "Belo Horizonte", state: "MG", priceCents: 4500,
  mediaKeys: ["listings/user/front.webp", "listings/user/back.webp", "listings/user/seal.webp"],
  officialCatalogMatch: true, updatedAt: "2026-10-20T12:00:00Z",
});

test("objective quality weights total one and exclude seller or Premium signals", () => {
  assert.ok(Math.abs(Object.values(LISTING_QUALITY_WEIGHTS).reduce((sum, value) => sum + value, 0) - 1) < Number.EPSILON);
  assert.deepEqual(Object.keys(LISTING_QUALITY_WEIGHTS), ["completeness", "photos", "catalogConsistency", "freshness"]);
});

test("complete, well photographed, official and recent listing reaches full score", () => {
  assert.equal(listingQualityScore(complete, { now: new Date("2026-10-24T12:00:00Z") }).score, 1);
});

test("photo score rewards useful coverage without growing after three photos", () => {
  assert.equal(listingPhotoScore({ mediaKeys: ["a"] }), 0.5);
  assert.equal(listingPhotoScore({ mediaKeys: ["a", "b"] }), 0.75);
  assert.equal(listingPhotoScore({ mediaKeys: ["a", "b", "c", "d"] }), 1);
  assert.equal(listingPhotoScore({ mediaKeys: ["a", "a"] }), 0.5);
});

test("freshness declines in disclosed bands and future dates receive no score", () => {
  const now = new Date("2026-10-24T00:00:00Z");
  assert.equal(listingFreshnessScore({ updatedAt: "2026-10-14T00:00:00Z" }, now), 0.75);
  assert.equal(listingFreshnessScore({ updatedAt: "2026-08-24T00:00:00Z" }, now), 0.5);
  assert.equal(listingFreshnessScore({ updatedAt: "2027-01-01T00:00:00Z" }, now), 0);
});

test("unknown catalog status earns no catalog points and never hides the listing", () => {
  const result = listingQualityScore({ ...complete, officialCatalogMatch: null },
    { now: new Date("2026-10-24T12:00:00Z") });
  assert.equal(result.score, 0.8);
  assert.equal(result.dimensions.catalogConsistency, 0);
  assert.equal(listingCompletenessScore({}), 0);
});
