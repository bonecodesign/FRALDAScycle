export const LISTING_LIFETIME_DAYS = 30;
export const PRM_CEILING_BASIS_POINTS = 9999;
const DAY_MS = 24 * 60 * 60 * 1000;

function positiveCents(value, name) {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(name + ' must be positive integer cents');
  return value;
}

export function effectivePriceCeiling({ prmCents, lowestRetailCents }) {
  const prm = positiveCents(prmCents, 'prmCents');
  const retail = positiveCents(lowestRetailCents, 'lowestRetailCents');
  const prmCeiling = Math.floor(prm * PRM_CEILING_BASIS_POINTS / 10000);
  return Math.min(prmCeiling, retail);
}

export function productEconomyBasisPoints({ prmCents, listingPriceCents }) {
  const prm = positiveCents(prmCents, 'prmCents');
  const price = positiveCents(listingPriceCents, 'listingPriceCents');
  return Math.round((prm - price) * 10000 / prm);
}

export function listingExpiry(publishedAt) {
  const timestamp = Date.parse(publishedAt);
  if (!Number.isFinite(timestamp)) throw new RangeError('Invalid publishedAt');
  return new Date(timestamp + LISTING_LIFETIME_DAYS * DAY_MS).toISOString();
}

export function monthlyReferenceWindow(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new RangeError('Invalid reference month');
  const from = new Date(Date.UTC(year, month - 1, 1));
  const until = new Date(Date.UTC(year, month, 1));
  return { validFrom: from.toISOString().slice(0, 10), validUntil: until.toISOString().slice(0, 10) };
}

export function priceAdjustmentRequired({ listingPriceCents, prmCents, lowestRetailCents }) {
  const price = positiveCents(listingPriceCents, 'listingPriceCents');
  const ceilingCents = effectivePriceCeiling({ prmCents, lowestRetailCents });
  return { required: price > ceilingCents, ceilingCents };
}
