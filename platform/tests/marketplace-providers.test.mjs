import assert from "node:assert/strict";
import test from "node:test";
import { createMarketplaceProviders, ProviderError } from "../apps/api/marketplace-providers.js";
import { createApiServer } from "../apps/api/server.js";
import { loadConfig } from "../apps/api/config.js";

const configured = {
  mediaProviderUrl: "https://media.example.com/sign",
  mediaProviderSecret: "media-secret",
  geocodingProviderUrl: "https://geo.example.com/resolve",
  geocodingProviderSecret: "geo-secret",
};

function response(payload, ok = true) {
  return { ok, async json() { return payload; } };
}

test("signed uploads validate media and keep provider credentials server-side", async () => {
  let request;
  const providers = createMarketplaceProviders(configured, async (url, options) => {
    request = { url, options };
    return response({
      uploadUrl: "https://storage.example.com/upload/one",
      storageKey: "listings/user-1/one.webp",
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      headers: { "x-storage-token": "opaque" },
    });
  });
  const result = await providers.signedUpload("user-1", { contentType: "image/webp", sizeBytes: 2048 });
  assert.equal(result.storageKey, "listings/user-1/one.webp");
  assert.match(request.options.headers.authorization, /^Bearer /);
  assert.doesNotMatch(JSON.stringify(result), /media-secret/);
  await assert.rejects(
    providers.signedUpload("user-1", { contentType: "text/html", sizeBytes: 10 }),
    (error) => error instanceof ProviderError && error.code === "invalid_media_type",
  );
});

test("signed uploads reject foreign keys, unsafe headers and invalid expiration", async () => {
  for (const payload of [
    {
      uploadUrl: "https://storage.example.com/upload/one",
      storageKey: "listings/another-user/one.webp",
      expiresAt: new Date(Date.now() + 60_000).toISOString(), headers: {},
    },
    {
      uploadUrl: "https://storage.example.com/upload/one",
      storageKey: "listings/user-1/one.webp",
      expiresAt: new Date(Date.now() + 60_000).toISOString(), headers: { authorization: "secret" },
    },
    {
      uploadUrl: "https://storage.example.com/upload/one",
      storageKey: "listings/user-1/one.webp",
      expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(), headers: {},
    },
    {
      uploadUrl: "https://user:secret@storage.example.com/upload/one",
      storageKey: "listings/user-1/one.webp",
      expiresAt: new Date(Date.now() + 60_000).toISOString(), headers: {},
    },
  ]) {
    const providers = createMarketplaceProviders(configured, async () => response(payload));
    await assert.rejects(
      providers.signedUpload("user-1", { contentType: "image/webp", sizeBytes: 2_048 }),
      (error) => error.code === "invalid_provider_response" && error.status === 502,
    );
  }
});

test("media verification rejects missing, foreign, mutable and unprocessed images", async () => {
  const key = "listings/user-1/one.webp";
  const ready = { storageKey: key, ownerId: "user-1", exists: true, processed: true,
    immutable: true, contentType: "image/webp", exifRemoved: true, scanStatus: "clean",
    sizeBytes: 2_048, width: 800, height: 800 };
  for (const patch of [
    { exists: false }, { ownerId: "another-user" }, { processed: false },
    { immutable: false }, { contentType: "text/html" }, { exifRemoved: false },
    { scanStatus: "pending" }, { sizeBytes: 10_000_001 }, { width: 1_601 }, { height: 0 },
  ]) {
    const providers = createMarketplaceProviders(configured, async () => response({ ...ready, ...patch }));
    await assert.rejects(providers.verifyListingMedia("user-1", [key]), error => error.code === "media_not_ready");
  }
  let request;
  const providers = createMarketplaceProviders(configured, async (_url, options) => {
    request = JSON.parse(options.body); return response(ready);
  });
  assert.deepEqual(await providers.verifyListingMedia("user-1", [key]), { verified: true, count: 1 });
  assert.equal(request.operation, "verify-listing-media");
  assert.equal(request.ownerId, "user-1");
  await assert.rejects(providers.verifyListingMedia("user-1", ["listings/other/one.webp"]), error => error.code === "invalid_media");
});

test("geocoding returns only approximate validated coordinates", async () => {
  const providers = createMarketplaceProviders(configured, async () => response({
    latitude: -19.9167, longitude: -43.9345, city: "Belo Horizonte", state: "mg",
  }));
  assert.deepEqual(await providers.geocode("user-1", { address: "Castelo, Belo Horizonte - MG" }), {
    latitude: -19.9167, longitude: -43.9345, city: "Belo Horizonte", state: "MG", approximate: true,
  });
});

test("unconfigured integrations fail explicitly without weakening production", async () => {
  const providers = createMarketplaceProviders({});
  await assert.rejects(
    providers.signedUpload("user-1", { contentType: "image/png", sizeBytes: 20 }),
    (error) => error.code === "provider_not_configured" && error.status === 503,
  );
});

test("provider HTTP endpoints require a valid user session", async (context) => {
  const authService = { async session(token) { return token === "valid" ? { id: "user-1" } : null; } };
  const marketplaceProviders = {
    async signedUpload(userId) { return { storageKey: `listings/${userId}/one.webp`, uploadUrl: "https://storage.example.com/one" }; },
    async geocode() { return { latitude: -19.9, longitude: -43.9, approximate: true }; },
  };
  const server = createApiServer({
    config: loadConfig({ NODE_ENV: "test" }), authService, marketplaceProviders,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;

  const denied = await fetch(`${origin}/v1/media/uploads`, {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}",
  });
  assert.equal(denied.status, 401);

  const allowed = await fetch(`${origin}/v1/media/uploads`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "fc_session=valid" },
    body: JSON.stringify({ contentType: "image/webp", sizeBytes: 100 }),
  });
  assert.equal(allowed.status, 201);
  assert.equal((await allowed.json()).upload.storageKey, "listings/user-1/one.webp");
});
