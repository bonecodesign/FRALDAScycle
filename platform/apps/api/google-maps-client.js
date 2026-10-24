const GEOCODING_ORIGIN = "https://maps.googleapis.com";
const ROUTES_ORIGIN = "https://routes.googleapis.com";

export class GoogleMapsError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GoogleMapsError";
    this.code = code;
  }
}

function validCoordinate(value, minimum, maximum) {
  return Number.isFinite(Number(value)) && Number(value) >= minimum && Number(value) <= maximum;
}

function coordinate(point) {
  if (!validCoordinate(point?.latitude, -90, 90) || !validCoordinate(point?.longitude, -180, 180)) {
    throw new GoogleMapsError("invalid_coordinates", "Informe coordenadas válidas para calcular a rota.");
  }
  return { latitude: Number(point.latitude), longitude: Number(point.longitude) };
}

function component(result, type) {
  return result.address_components?.find((entry) => entry.types?.includes(type));
}

async function jsonRequest(url, options, fetchImpl, timeoutMs) {
  let response;
  try {
    response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new GoogleMapsError("provider_unavailable", "Google Maps temporariamente indisponível.");
  }
  if (!response.ok) {
    throw new GoogleMapsError("provider_rejected", "Google Maps recusou a solicitação.");
  }
  try {
    return await response.json();
  } catch {
    throw new GoogleMapsError("invalid_provider_response", "Google Maps retornou uma resposta inválida.");
  }
}

// Cliente nativo isolado. Ativação exige chave restrita por API/IP, teto de
// faturamento, cota diária e homologação dos endereços do piloto em BH.
export function createGoogleMapsClient({ apiKey, fetchImpl = fetch, timeoutMs = 5_000 }) {
  if (typeof apiKey !== "string" || apiKey.length < 8 || !Number.isInteger(timeoutMs) || timeoutMs < 100) {
    throw new Error("Invalid Google Maps configuration");
  }

  return Object.freeze({
    async geocodeBh(address) {
      const normalized = String(address ?? "").trim();
      if (normalized.length < 5 || normalized.length > 300) {
        throw new GoogleMapsError("invalid_address", "Informe um endereço válido.");
      }
      const url = new URL("/maps/api/geocode/json", GEOCODING_ORIGIN);
      url.searchParams.set("address", normalized);
      url.searchParams.set("components", "country:BR|administrative_area:MG|locality:Belo Horizonte");
      url.searchParams.set("region", "br");
      url.searchParams.set("language", "pt-BR");
      url.searchParams.set("key", apiKey);
      const payload = await jsonRequest(url, { method: "GET" }, fetchImpl, timeoutMs);
      if (payload.status !== "OK" || !Array.isArray(payload.results) || payload.results.length < 1) {
        throw new GoogleMapsError("address_not_found", "Endereço não encontrado no município de Belo Horizonte.");
      }
      const result = payload.results[0];
      const country = component(result, "country")?.short_name;
      const state = component(result, "administrative_area_level_1")?.short_name;
      const city = component(result, "locality")?.long_name
        ?? component(result, "administrative_area_level_2")?.long_name;
      const location = result.geometry?.location;
      if (country !== "BR" || state !== "MG" || city !== "Belo Horizonte"
          || !validCoordinate(location?.lat, -90, 90) || !validCoordinate(location?.lng, -180, 180)) {
        throw new GoogleMapsError("outside_pilot_area", "O endereço está fora da área atual do piloto em Belo Horizonte.");
      }
      return Object.freeze({
        latitude: Number(location.lat),
        longitude: Number(location.lng),
        city,
        state,
        formattedAddress: String(result.formatted_address ?? "").slice(0, 300) || null,
        partialMatch: result.partial_match === true,
        provider: "google-maps",
      });
    },

    async route(origin, destination) {
      const body = {
        origin: { location: { latLng: coordinate(origin) } },
        destination: { location: { latLng: coordinate(destination) } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        languageCode: "pt-BR",
        units: "METRIC",
      };
      const payload = await jsonRequest(`${ROUTES_ORIGIN}/directions/v2:computeRoutes`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
          "x-goog-fieldmask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify(body),
      }, fetchImpl, timeoutMs);
      const route = payload.routes?.[0];
      const durationMatch = /^(\d+(?:\.\d+)?)s$/.exec(String(route?.duration ?? ""));
      if (!Number.isInteger(route?.distanceMeters) || route.distanceMeters < 1 || !durationMatch) {
        throw new GoogleMapsError("route_not_found", "Não foi possível calcular uma rota válida.");
      }
      return Object.freeze({
        distanceMeters: route.distanceMeters,
        durationSeconds: Math.ceil(Number(durationMatch[1])),
        encodedPolyline: typeof route.polyline?.encodedPolyline === "string"
          ? route.polyline.encodedPolyline : null,
        provider: "google-maps",
      });
    },
  });
}
