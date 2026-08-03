import assert from "node:assert/strict";
import test from "node:test";
import { createMarketplaceProviders, ProviderError } from "../apps/api/marketplace-providers.js";

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
      expiresAt: "2026-08-03T02:00:00Z",
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
