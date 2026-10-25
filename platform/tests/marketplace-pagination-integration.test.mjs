import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createMarketplaceService } from "../apps/api/marketplace-service.js";
import { createMarketplaceRepository } from "../database/marketplace-repository.js";
import { readMarketplaceCursor } from "../packages/contracts/marketplace-pagination.js";

const secret = "synthetic-marketplace-cursor-secret-0001";
const clock = () => new Date("2026-10-25T12:00:00Z");
const row = index => ({ id: `10000000-0000-4000-8000-${String(index).padStart(12,"0")}`,
  distance_km: index, published_at: "2026-10-25T10:00:00Z", created_at: "2026-10-25T09:00:00Z" });

test("service fetches one extra row and emits a filter-bound next cursor", async () => {
  const calls = [];
  const service = createMarketplaceService({ async searchPage(input) {
    calls.push(input);
    return Array.from({ length: input.limit }, (_, index) => row(index + 1));
  } }, null, null, { cursorSecret: secret, now: clock });
  const first = await service.searchPage({ category: "infant", kind: "sale", limit: "2" });
  assert.equal(calls[0].limit, 3);
  assert.equal(first.items.length, 2);
  assert.equal(first.hasMore, true);
  const decoded = readMarketplaceCursor(first.nextCursor, {
    secret, filters: { query: "", size: "", category: "infant", kind: "sale", latitude: null,
      longitude: null, radiusKm: null, sort: "" }, now: clock(),
  });
  assert.equal(decoded.id, row(2).id);
  await service.searchPage({ category: "infant", kind: "sale", limit: "2", cursor: first.nextCursor });
  assert.equal(calls[1].cursor.id, row(2).id);
});

test("repository applies keyset fields and immutable ordering without OFFSET", async () => {
  let statement;
  const repository = createMarketplaceRepository({ async query(sql, values) { statement = { sql, values }; return { rows: [] }; } });
  await repository.searchPage({ category: "infant", limit: 25, cursor: {
    id: row(2).id, distanceKm: 2, publishedAt: row(2).published_at, createdAt: row(2).created_at,
  } });
  assert.match(statement.sql, /id>\$14::uuid/);
  assert.match(statement.sql, /ORDER BY distance_km ASC NULLS LAST,published_at DESC,created_at DESC,id ASC/);
  assert.doesNotMatch(statement.sql, /OFFSET/);
  assert.equal(statement.values[9], true);
});

test("existing positive offset clients remain compatible during cursor migration", async () => {
  let legacy;
  const service = createMarketplaceService({
    async search(input) { legacy = input; return [row(9)]; },
    async searchPage() { assert.fail("keyset query must not run for a legacy positive offset"); },
  }, null, null, { cursorSecret: secret, now: clock });
  const result = await service.searchPage({ offset: "24", limit: "24", category: "infant" });
  assert.equal(legacy.offset, 24);
  assert.equal(result.legacyOffset, true);
  assert.equal(result.items[0].id, row(9).id);
});

test("HTTP handler advertises private five-minute cache and cursor response", async () => {
  const source = await readFile(new URL("../apps/api/marketplace-handler.js", import.meta.url), "utf8");
  assert.match(source, /MARKETPLACE_CACHE_CONTROL/);
  assert.match(source, /marketplaceService\.searchPage/);
  assert.match(source, /\{ \.\.\.result, requestId \}/);
});
