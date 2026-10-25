import assert from "node:assert/strict";
import test from "node:test";
import {
  MARKETPLACE_CACHE_CONTROL,
  MARKETPLACE_CURSOR_TTL_SECONDS,
  compareMarketplacePositions,
  createMarketplaceCursor,
  marketplaceFilterFingerprint,
  readMarketplaceCursor,
} from "../packages/contracts/marketplace-pagination.js";

const secret = "synthetic-marketplace-cursor-secret-0001";
const now = new Date("2026-10-24T12:00:00Z");
const filters = { category: "infant", kind: "sale", query: "premium", limit: 24 };
const position = { id: "10000000-0000-4000-8000-000000000001", distanceKm: 4.25,
  generalScore: 0.9, publishedAt: "2026-10-24T10:00:00Z", createdAt: "2026-10-24T09:00:00Z" };

test("cursor is signed, filter-bound and expires with the five-minute cache window", () => {
  const cursor = createMarketplaceCursor({ secret, filters, position, now });
  const decoded = readMarketplaceCursor(cursor, { secret, filters, now: new Date("2026-10-24T12:04:59Z") });
  assert.equal(decoded.id, position.id);
  assert.equal(decoded.distanceKm, 4.25);
  assert.equal(decoded.generalScore, 0.9);
  assert.equal(decoded.expiresAt, "2026-10-24T12:05:00.000Z");
  assert.equal(MARKETPLACE_CURSOR_TTL_SECONDS, 300);
  assert.equal(MARKETPLACE_CACHE_CONTROL, "private, max-age=300");
});

test("tampering, expiration and filter reuse are rejected before database access", () => {
  const cursor = createMarketplaceCursor({ secret, filters, position, now });
  const tampered = `${cursor.slice(0, -1)}${cursor.endsWith("a") ? "b" : "a"}`;
  assert.throws(() => readMarketplaceCursor(tampered, { secret, filters, now }), error => error.code === "invalid_marketplace_cursor");
  assert.throws(() => readMarketplaceCursor(cursor, { secret, filters: { ...filters, kind: "donation" }, now }),
    error => error.code === "marketplace_cursor_filter_mismatch");
  assert.throws(() => readMarketplaceCursor(cursor, { secret, filters, now: new Date("2026-10-24T12:05:01Z") }),
    error => error.code === "expired_marketplace_cursor");
});

test("page size does not change filter identity and ordering has an immutable UUID tie-breaker", () => {
  assert.equal(marketplaceFilterFingerprint({ ...filters, limit: 24 }), marketplaceFilterFingerprint({ ...filters, limit: 50 }));
  const newer = { ...position, id: "10000000-0000-4000-8000-000000000002", publishedAt: "2026-10-24T11:00:00Z" };
  const farther = { ...position, id: "10000000-0000-4000-8000-000000000003", distanceKm: 20, generalScore: 0.6 };
  const noDistance = { ...position, id: "10000000-0000-4000-8000-000000000004", distanceKm: null, generalScore: 0.5 };
  assert.deepEqual([farther, noDistance, newer, position].sort(compareMarketplacePositions).map(item => item.id),
    [newer.id, position.id, farther.id, noDistance.id]);
});
