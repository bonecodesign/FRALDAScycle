import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const MARKETPLACE_CURSOR_TTL_SECONDS = 300;
export const MARKETPLACE_CACHE_CONTROL = "private, max-age=300";

const VERSION = 1;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedFilters = ["category", "kind", "latitude", "longitude", "query", "radiusKm", "size", "sort"];

const encode = value => Buffer.from(value).toString("base64url");
const decode = value => Buffer.from(value, "base64url").toString("utf8");

export function marketplaceFilterFingerprint(filters = {}) {
  const canonical = Object.fromEntries(allowedFilters.map(key => [key, String(filters[key] ?? "").trim()]));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("base64url");
}

function normalizedPosition(position) {
  const publishedAt = new Date(position?.publishedAt ?? position?.published_at ?? "");
  const createdAt = new Date(position?.createdAt ?? position?.created_at ?? "");
  const distance = position?.distanceKm ?? position?.distance_km;
  const distanceKm = distance === null || distance === undefined ? null : Number(distance);
  const id = String(position?.id ?? "");
  if (!UUID.test(id) || !Number.isFinite(publishedAt.getTime()) || !Number.isFinite(createdAt.getTime())
      || distanceKm !== null && (!Number.isFinite(distanceKm) || distanceKm < 0)) {
    throw Object.assign(new Error("Invalid marketplace cursor position"), { code: "invalid_marketplace_cursor" });
  }
  return { distanceKm, publishedAt: publishedAt.toISOString(), createdAt: createdAt.toISOString(), id };
}

export function createMarketplaceCursor({ secret, filters, position, now = new Date() }) {
  if (typeof secret !== "string" || secret.length < 32 || !Number.isFinite(now.getTime())) {
    throw new TypeError("A cursor secret of at least 32 characters and a valid clock are required");
  }
  const payload = encode(JSON.stringify({
    v: VERSION,
    exp: Math.floor(now.getTime() / 1000) + MARKETPLACE_CURSOR_TTL_SECONDS,
    filters: marketplaceFilterFingerprint(filters),
    position: normalizedPosition(position),
  }));
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readMarketplaceCursor(cursor, { secret, filters, now = new Date() }) {
  const fail = code => { throw Object.assign(new Error("Invalid marketplace cursor"), { code, status: 400 }); };
  if (typeof secret !== "string" || secret.length < 32 || typeof cursor !== "string" || cursor.length > 2_000
      || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(cursor) || !Number.isFinite(now.getTime())) fail("invalid_marketplace_cursor");
  const [payload, signature] = cursor.split(".");
  const expected = createHmac("sha256", secret).update(payload).digest();
  let actual;
  try { actual = Buffer.from(signature, "base64url"); } catch { fail("invalid_marketplace_cursor"); }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) fail("invalid_marketplace_cursor");
  let parsed;
  try { parsed = JSON.parse(decode(payload)); } catch { fail("invalid_marketplace_cursor"); }
  if (parsed.v !== VERSION || !Number.isSafeInteger(parsed.exp)
      || parsed.exp < Math.floor(now.getTime() / 1000)) fail("expired_marketplace_cursor");
  if (parsed.filters !== marketplaceFilterFingerprint(filters)) fail("marketplace_cursor_filter_mismatch");
  try { return Object.freeze({ expiresAt: new Date(parsed.exp * 1000).toISOString(), ...normalizedPosition(parsed.position) }); }
  catch { fail("invalid_marketplace_cursor"); }
}

export function compareMarketplacePositions(left, right) {
  const a = normalizedPosition(left);
  const b = normalizedPosition(right);
  if (a.distanceKm === null && b.distanceKm !== null) return 1;
  if (a.distanceKm !== null && b.distanceKm === null) return -1;
  if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
  const published = Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  if (published) return published;
  const created = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  if (created) return created;
  return a.id.localeCompare(b.id);
}
