const STORAGE_KEY = "fraldacycle.demo.listings";

export function resetDemoListings(storage) {
  storage.removeItem(STORAGE_KEY);
}

export const initialDemoListings = [
  ["demo-1", "sell", "Pampers Confort Sec", "M", 36, 5290, "Savassi"],
  ["demo-2", "sell", "Huggies Supreme Care", "G", 30, 4890, "Funcionários"],
  ["demo-3", "donate", "MamyPoko Dia & Noite", "M", 42, null, "Lourdes"],
  ["demo-4", "sell", "Cremer Magic Care", "P", 34, 3990, "Santa Efigênia"],
  ["demo-5", "buy", "Pampers Pants", "XG", 28, null, "Floresta"],
  ["demo-6", "sell", "Huggies Tripla Proteção", "G", 40, 5190, "Buritis"],
  ["demo-7", "donate", "Personal Baby", "M", 32, null, "Sion"],
  ["demo-8", "sell", "Babysec UltraSec", "G", 36, 4290, "Cidade Nova"],
  ["demo-9", "buy", "Pampers Premium Care", "P", 28, null, "Castelo"],
  ["demo-10", "sell", "Huggies Natural Care", "M", 44, 5390, "Pampulha"],
].map(([id, type, brand, diaperSize, units, priceCents, neighborhood]) => ({
  id,
  type,
  brand,
  diaperSize,
  units,
  priceCents,
  sealed: true,
  ownerEmail: "comunidade@tester.fraldacycle.local",
  location: { city: "Belo Horizonte", state: "MG", neighborhood },
}));

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttpUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function validateDemoListing(listing) {
  const errors = [];
  if (!["buy", "sell", "donate"].includes(listing?.type)) {
    errors.push("type must be buy, sell, or donate");
  }
  if (listing?.sealed !== true) errors.push("listing must describe a sealed package");
  if (!isNonEmptyString(listing?.brand)) errors.push("brand is required");
  if (!isNonEmptyString(listing?.diaperSize)) errors.push("diaperSize is required");
  if (!Number.isInteger(listing?.units) || listing.units <= 0) {
    errors.push("units must be a positive integer");
  }
  if (
    !listing?.location ||
    !isNonEmptyString(listing.location.city) ||
    !isNonEmptyString(listing.location.state)
  ) {
    errors.push("location is required");
  }
  if (
    listing?.photoUrl !== undefined &&
    (!isNonEmptyString(listing.photoUrl) ||
      !isHttpUrl(listing.photoUrl))
  ) {
    errors.push("photoUrl must be a valid http or https URL");
  }
  if (
    listing?.type === "sell" &&
    (!Number.isInteger(listing.priceCents) || listing.priceCents <= 0)
  ) {
    errors.push("priceCents must be a positive integer for sell listings");
  }
  if (listing?.type === "donate" && listing.priceCents !== undefined) {
    errors.push("donate listings cannot include priceCents");
  }
  return errors;
}

function normalizeDemoListing(listing) {
  return {
    ...listing,
    brand: listing.brand.trim(),
    diaperSize: listing.diaperSize.trim(),
    ...(listing.photoUrl ? { photoUrl: listing.photoUrl.trim() } : {}),
    location: {
      ...listing.location,
      city: listing.location.city.trim(),
      state: listing.location.state.trim().toUpperCase(),
    },
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function createDemoApi({
  apiUrl,
  storage,
  getUser,
  fetchImpl = globalThis.fetch,
  now = Date.now,
}) {
  function readListings() {
    try {
      return JSON.parse(storage.getItem(STORAGE_KEY)) ?? initialDemoListings;
    } catch {
      storage.removeItem(STORAGE_KEY);
      return initialDemoListings;
    }
  }

  function writeListings(listings) {
    storage.setItem(STORAGE_KEY, JSON.stringify(listings));
  }

  return async function apiFetch(url, options = {}) {
    if (apiUrl) return fetchImpl(url, options);

    const requestUrl = new URL(url, "https://demo.fraldacycle.local");
    const path = requestUrl.pathname.replace(/^\/demo-api/, "");
    const method = options.method ?? "GET";

    if (path.startsWith("/auth/") && method === "POST") {
      const credentials = JSON.parse(options.body);
      if (!credentials.email?.toLowerCase().endsWith("@tester.fraldacycle.local")) {
        return jsonResponse(
          { error: "Use um e-mail @tester.fraldacycle.local nesta demonstração." },
          400,
        );
      }
      if (typeof credentials.password !== "string" || credentials.password.length < 8) {
        return jsonResponse({ error: "A senha deve ter pelo menos 8 caracteres." }, 400);
      }
      return jsonResponse({
        token: "demo-session",
        user: { id: "demo-user", email: credentials.email.trim().toLowerCase() },
      });
    }

    if (path === "/listings" && method === "GET") {
      const city = requestUrl.searchParams.get("city")?.trim().toLowerCase();
      const state = requestUrl.searchParams.get("state")?.trim().toLowerCase();
      const type = requestUrl.searchParams.get("type");
      const listings = readListings().filter(
        (listing) =>
          (!city || listing.location.city.toLowerCase().includes(city)) &&
          (!state || listing.location.state.toLowerCase() === state) &&
          (!type || listing.type === type),
      );
      return jsonResponse({ listings });
    }

    if (path === "/my/listings" && method === "GET") {
      const email = getUser()?.email;
      return jsonResponse({
        listings: readListings().filter((listing) => listing.ownerEmail === email),
      });
    }

    if (path === "/listings" && method === "POST") {
      const owner = getUser();
      if (!owner) return jsonResponse({ error: "Entre antes de publicar." }, 401);
      const input = JSON.parse(options.body);
      const errors = validateDemoListing(input);
      if (errors.length > 0) return jsonResponse({ errors }, 400);

      const listing = {
        ...normalizeDemoListing(input),
        id: `demo-${now()}`,
        ownerEmail: owner.email,
      };
      writeListings([listing, ...readListings()]);
      return jsonResponse({ listing }, 201);
    }

    if (path.startsWith("/listings/") && method === "DELETE") {
      const owner = getUser();
      if (!owner) return jsonResponse({ error: "Entre antes de remover." }, 401);
      const id = decodeURIComponent(path.slice("/listings/".length));
      const listings = readListings();
      const listing = listings.find((item) => item.id === id);
      if (!listing || listing.ownerEmail !== owner.email) {
        return jsonResponse({ error: "Anúncio não encontrado." }, 404);
      }
      writeListings(listings.filter((item) => item.id !== id));
      return jsonResponse({ removed: true });
    }

    return jsonResponse({ error: "Recurso demonstrativo indisponível." }, 404);
  };
}
