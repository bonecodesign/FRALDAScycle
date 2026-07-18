import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class FileListingRepository {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async #readListings() {
    try {
      const listings = JSON.parse(await readFile(this.filePath, "utf8"));

      if (!Array.isArray(listings)) throw new Error("Listing data must be an array");
      return listings;
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async #writeListings(listings) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryFilePath = `${this.filePath}.tmp`;
    await writeFile(temporaryFilePath, JSON.stringify(listings, null, 2), "utf8");
    await rename(temporaryFilePath, this.filePath);
  }

  async create(listing) {
    const listings = await this.#readListings();
    const storedListing = {
      ...listing,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    listings.push(storedListing);
    await this.#writeListings(listings);
    return storedListing;
  }

  async list({ city, state, type, status } = {}) {
    const listings = await this.#readListings();

    return listings.filter((listing) => {
      if (type && listing.type !== type) return false;
      if (status && listing.status !== status) return false;
      if (city && listing.location.city.toLowerCase() !== city.toLowerCase()) return false;
      if (state && listing.location.state !== state.toUpperCase()) return false;
      return true;
    });
  }

  async listByOwner(ownerId) {
    return (await this.#readListings()).filter((listing) => listing.ownerId === ownerId);
  }

  async updateStatusById(id, status) {
    const listings = await this.#readListings();
    const listing = listings.find((item) => item.id === id);

    if (!listing) return null;

    listing.status = status;
    listing.updatedAt = new Date().toISOString();
    await this.#writeListings(listings);
    return listing;
  }

  async deleteByIdAndOwner(id, ownerId) {
    const listings = await this.#readListings();
    const index = listings.findIndex(
      (listing) => listing.id === id && listing.ownerId === ownerId,
    );

    if (index === -1) return false;

    listings.splice(index, 1);
    await this.#writeListings(listings);
    return true;
  }
}
