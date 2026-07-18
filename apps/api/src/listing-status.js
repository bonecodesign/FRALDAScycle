export const LISTING_STATUS = Object.freeze({
  ACTIVE: "active",
  BLOCKED: "blocked",
  CLOSED: "closed",
  PENDING: "pending",
});

export function isListingStatus(value) {
  return Object.values(LISTING_STATUS).includes(value);
}
