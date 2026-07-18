export const LISTING_TYPES = Object.freeze({
  BUY: "buy",
  SELL: "sell",
  DONATE: "donate",
});

export class ListingValidationError extends Error {
  constructor(errors) {
    super("Invalid listing");
    this.name = "ListingValidationError";
    this.errors = errors;
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isImageUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function validateListing(listing) {
  const errors = [];

  if (!listing || typeof listing !== "object") {
    return ["listing must be an object"];
  }

  if (!Object.values(LISTING_TYPES).includes(listing.type)) {
    errors.push("type must be buy, sell, or donate");
  }

  if (listing.sealed !== true) {
    errors.push("listing must describe a sealed package");
  }

  if (!isNonEmptyString(listing.brand)) {
    errors.push("brand is required");
  }

  if (!isNonEmptyString(listing.diaperSize)) {
    errors.push("diaperSize is required");
  }

  if (!isPositiveInteger(listing.units)) {
    errors.push("units must be a positive integer");
  }

  if (listing.photoUrl !== undefined && (!isNonEmptyString(listing.photoUrl) || !isImageUrl(listing.photoUrl))) {
    errors.push("photoUrl must be a valid http or https URL");
  }

  if (!listing.location || typeof listing.location !== "object") {
    errors.push("location is required");
  } else {
    if (!isNonEmptyString(listing.location.city)) {
      errors.push("location.city is required");
    }

    if (!isNonEmptyString(listing.location.state)) {
      errors.push("location.state is required");
    }
  }

  if (listing.type === LISTING_TYPES.SELL && !isPositiveInteger(listing.priceCents)) {
    errors.push("priceCents must be a positive integer for sell listings");
  }

  if (listing.type === LISTING_TYPES.DONATE && listing.priceCents !== undefined) {
    errors.push("donate listings cannot include priceCents");
  }

  return errors;
}

export function createListing(input) {
  const errors = validateListing(input);

  if (errors.length > 0) {
    throw new ListingValidationError(errors);
  }

  return {
    ...input,
    ...(input.photoUrl ? { photoUrl: input.photoUrl.trim() } : {}),
    brand: input.brand.trim(),
    diaperSize: input.diaperSize.trim(),
    location: {
      city: input.location.city.trim(),
      state: input.location.state.trim().toUpperCase(),
    },
  };
}
