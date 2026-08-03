export class MarketplaceError extends Error {
  constructor(code, status, message) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const KINDS = new Set(["sale", "exchange", "donation"]);

export function createMarketplaceService(repository) {
  return Object.freeze({
    async search(params = {}) {
      const limit = Math.min(50, Math.max(1, Number(params.limit) || 24));
      const offset = Math.max(0, Number(params.offset) || 0);
      const kind = params.kind && KINDS.has(params.kind) ? params.kind : null;
      const hasLatitude = params.latitude != null && params.latitude !== "";
      const hasLongitude = params.longitude != null && params.longitude !== "";
      if (hasLatitude !== hasLongitude) {
        throw new MarketplaceError("invalid_location", 422, "Informe latitude e longitude juntas.");
      }
      const latitude = hasLatitude ? Number(params.latitude) : null;
      const longitude = hasLongitude ? Number(params.longitude) : null;
      if (latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
          !Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
        throw new MarketplaceError("invalid_location", 422, "Informe coordenadas válidas.");
      }
      const radiusKm = latitude == null ? null : Math.min(200, Math.max(1, Number(params.radiusKm) || 25));
      return repository.search({
        query: String(params.query ?? "").trim() || null,
        size: String(params.size ?? "").trim() || null,
        kind, latitude, longitude, radiusKm, limit, offset,
      });
    },

    async detail(id) {
      const listing = await repository.detail(id);
      if (!listing) throw new MarketplaceError("listing_not_found", 404, "Anúncio não encontrado.");
      return listing;
    },

    async create(userId, input) {
      const title = String(input?.title ?? "").trim();
      const description = String(input?.description ?? "").trim();
      const kind = String(input?.kind ?? "");
      const quantity = Number(input?.quantity);
      const priceCents = input?.priceCents == null ? null : Number(input.priceCents);
      if (title.length < 5 || title.length > 120) throw new MarketplaceError("invalid_title", 422, "Informe o título do anúncio.");
      if (description.length < 20 || description.length > 4000) throw new MarketplaceError("invalid_description", 422, "Descreva o produto com mais detalhes.");
      if (!KINDS.has(kind)) throw new MarketplaceError("invalid_kind", 422, "Escolha venda, troca ou doação.");
      if (!Number.isInteger(quantity) || quantity < 1) throw new MarketplaceError("invalid_quantity", 422, "Informe uma quantidade válida.");
      if (kind === "sale" && (!Number.isInteger(priceCents) || priceCents < 0)) throw new MarketplaceError("invalid_price", 422, "Informe um valor válido.");
      if (kind !== "sale" && priceCents !== null) throw new MarketplaceError("unexpected_price", 422, "Trocas e doações não possuem preço.");
      return repository.create({
        sellerId: userId, title, description, kind, quantity, priceCents,
        brand: String(input?.brand ?? "").trim() || null,
        size: String(input?.size ?? "").trim() || null,
        city: String(input?.city ?? "").trim() || null,
        state: String(input?.state ?? "").trim().toUpperCase() || null,
        latitude: input?.latitude ?? null, longitude: input?.longitude ?? null,
        mediaKeys: Array.isArray(input?.mediaKeys) ? input.mediaKeys.slice(0, 8) : [],
      });
    },

    favorites(userId) { return repository.favorites(userId); },
    async addFavorite(userId, listingId) { await repository.addFavorite(userId, listingId); return { saved: true }; },
    async removeFavorite(userId, listingId) { await repository.removeFavorite(userId, listingId); return { saved: false }; },
  });
}
