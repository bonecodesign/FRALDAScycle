import assert from "node:assert/strict";
import test from "node:test";

import {
  createListing,
  LISTING_TYPES,
  ListingValidationError,
  validateListing,
} from "./listing.js";

const validSellListing = {
  type: LISTING_TYPES.SELL,
  sealed: true,
  brand: "  FraldaCycle  ",
  diaperSize: "M",
  units: 30,
  priceCents: 4590,
  location: {
    city: "  São Paulo ",
    state: "sp",
  },
};

test("accepts and normalizes a sealed sell listing", () => {
  const listing = createListing(validSellListing);

  assert.equal(listing.brand, "FraldaCycle");
  assert.equal(listing.location.city, "São Paulo");
  assert.equal(listing.location.state, "SP");
});

test("rejects opened packages", () => {
  const errors = validateListing({ ...validSellListing, sealed: false });

  assert.deepEqual(errors, ["listing must describe a sealed package"]);
});

test("requires a price for sell listings", () => {
  const errors = validateListing({ ...validSellListing, priceCents: undefined });

  assert.deepEqual(errors, ["priceCents must be a positive integer for sell listings"]);
});

test("rejects a price on donate listings", () => {
  const errors = validateListing({
    ...validSellListing,
    type: LISTING_TYPES.DONATE,
  });

  assert.deepEqual(errors, ["donate listings cannot include priceCents"]);
});

test("exposes validation errors when creating an invalid listing", () => {
  assert.throws(
    () => createListing({ ...validSellListing, units: 0 }),
    (error) =>
      error instanceof ListingValidationError &&
      error.errors.includes("units must be a positive integer"),
  );
});
