import { randomUUID } from "node:crypto";

export class InMemoryListingRepository {
  #listings = [];

  create(listing) {
    const storedListing = {
      ...listing,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };

    this.#listings.push(storedListing);

    return storedListing;
  }

  list({ city, state, type } = {}) {
    return this.#listings.filter((listing) => {
      if (type && listing.type !== type) {
        return false;
      }

      if (city && listing.location.city.toLowerCase() !== city.toLowerCase()) {
        return false;
      }

      if (state && listing.location.state !== state.toUpperCase()) {
        return false;
      }

      return true;
    });
  }

  listByOwner(ownerId) {
    return this.#listings.filter((listing) => listing.ownerId === ownerId);
  }

  deleteByIdAndOwner(id, ownerId) {
    const index = this.#listings.findIndex(
      (listing) => listing.id === id && listing.ownerId === ownerId,
    );

    if (index === -1) {
      return false;
    }

    this.#listings.splice(index, 1);

    return true;
  }
}
