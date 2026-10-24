import assert from "node:assert/strict";
import test from "node:test";
import { createGoogleMapsClient, GoogleMapsError } from "../apps/api/google-maps-client.js";

const components = [
  { long_name: "Belo Horizonte", short_name: "Belo Horizonte", types: ["locality"] },
  { long_name: "Minas Gerais", short_name: "MG", types: ["administrative_area_level_1"] },
  { long_name: "Brasil", short_name: "BR", types: ["country"] },
];

function response(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

test("Google Maps geocodes only a validated Belo Horizonte address", async () => {
  let request;
  const client = createGoogleMapsClient({ apiKey: "server-key-123", fetchImpl: async (url, options) => {
    request = { url: String(url), options };
    return response({ status: "OK", results: [{ address_components: components,
      formatted_address: "Praça Sete, Belo Horizonte - MG, Brasil",
      geometry: { location: { lat: -19.9191, lng: -43.9386 } } }] });
  } });
  const result = await client.geocodeBh("Praça Sete, Belo Horizonte - MG");
  assert.equal(result.provider, "google-maps");
  assert.equal(result.city, "Belo Horizonte");
  assert.equal(result.state, "MG");
  assert.equal(new URL(request.url).origin, "https://maps.googleapis.com");
  assert.equal(new URL(request.url).searchParams.get("components"), "country:BR|administrative_area:MG|locality:Belo Horizonte");
  assert.doesNotMatch(JSON.stringify(result), /server-key-123/);
});

test("Google Maps refuses a geocoder result outside the BH pilot", async () => {
  const outside = components.map((entry) => entry.types.includes("locality")
    ? { ...entry, long_name: "Contagem", short_name: "Contagem" } : entry);
  const client = createGoogleMapsClient({ apiKey: "server-key-123", fetchImpl: async () => response({
    status: "OK", results: [{ address_components: outside, geometry: { location: { lat: -19.9, lng: -44.0 } } }],
  }) });
  await assert.rejects(client.geocodeBh("Centro, Contagem - MG"),
    (error) => error instanceof GoogleMapsError && error.code === "outside_pilot_area");
});

test("Google Routes sends minimal coordinates and returns normalized distance and duration", async () => {
  let request;
  const client = createGoogleMapsClient({ apiKey: "server-key-123", fetchImpl: async (url, options) => {
    request = { url, options };
    return response({ routes: [{ distanceMeters: 8240, duration: "901.4s",
      polyline: { encodedPolyline: "opaque-polyline" } }] });
  } });
  const result = await client.route(
    { latitude: -19.9191, longitude: -43.9386 },
    { latitude: -19.8507, longitude: -43.9237 },
  );
  assert.deepEqual(result, { distanceMeters: 8240, durationSeconds: 902,
    encodedPolyline: "opaque-polyline", provider: "google-maps" });
  assert.equal(request.url, "https://routes.googleapis.com/directions/v2:computeRoutes");
  assert.equal(request.options.headers["x-goog-api-key"], "server-key-123");
  assert.doesNotMatch(request.options.body, /server-key-123/);
  assert.deepEqual(Object.keys(JSON.parse(request.options.body)).sort(),
    ["destination", "languageCode", "origin", "routingPreference", "travelMode", "units"]);
});

test("Google Maps sanitizes provider failures and rejects invalid routes", async () => {
  const rejected = createGoogleMapsClient({ apiKey: "server-key-123",
    fetchImpl: async () => response({ error: { message: "sensitive provider detail" } }, 403) });
  await assert.rejects(rejected.route({ latitude: -19.9, longitude: -43.9 },
    { latitude: -19.8, longitude: -43.8 }),
  (error) => error.code === "provider_rejected" && !error.message.includes("sensitive"));

  const invalid = createGoogleMapsClient({ apiKey: "server-key-123",
    fetchImpl: async () => response({ routes: [{ distanceMeters: 0, duration: "invalid" }] }) });
  await assert.rejects(invalid.route({ latitude: -19.9, longitude: -43.9 },
    { latitude: -19.8, longitude: -43.8 }), (error) => error.code === "route_not_found");
});
