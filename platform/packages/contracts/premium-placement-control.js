export const PREMIUM_PLACEMENT_INTERVAL = 5;

function eligible(item, { manualSort }) {
  const blockers = [];
  if (manualSort) blockers.push("manual_sort_active");
  if (item?.premiumActive !== true) blockers.push("premium_inactive");
  if (item?.status !== "published") blockers.push("listing_not_published");
  if (item?.matchesFilters !== true) blockers.push("listing_outside_filters");
  if (item?.moderationAllowed !== true) blockers.push("moderation_blocked");
  if (item?.duplicateAction && item.duplicateAction !== "allow") blockers.push("duplicate_control_blocked");
  if (!Number.isInteger(item?.distanceBand) || item.distanceBand < 0 || item.distanceBand > 3) {
    blockers.push("distance_band_unavailable");
  }
  return Object.freeze({ eligible: blockers.length === 0, blockers: Object.freeze(blockers) });
}

export function premiumPlacementEligibility(item, options = {}) {
  const result = eligible(item, { manualSort: options.manualSort === true });
  return Object.freeze({ ...result, paidOverrideAllowed: false, qualityOverrideAllowed: false });
}

export function applyPremiumPlacement(organicListings, { manualSort = false } = {}) {
  if (!Array.isArray(organicListings)) throw new TypeError("Organic listings must be an array");
  const seenIds = new Set();
  const source = organicListings.map((item, organicIndex) => {
    if (!item || typeof item.id !== "string" || !item.id || seenIds.has(item.id)
        || typeof item.sellerId !== "string" || !item.sellerId) throw new TypeError("Invalid organic listing");
    seenIds.add(item.id);
    return { ...item, organicIndex, premiumPlacement: false };
  });
  if (manualSort) return Object.freeze(source.map(Object.freeze));

  const output = [];
  const remaining = [...source];
  const lastFeaturedBlockBySeller = new Map();
  let block = 0;
  while (remaining.length) {
    const natural = remaining.splice(0, PREMIUM_PLACEMENT_INTERVAL);
    const referenceBand = natural[0]?.distanceBand;
    const candidates = natural.filter(item => {
      const gate = eligible(item, { manualSort: false });
      return gate.eligible && Math.abs(item.distanceBand - referenceBand) <= 1
        && lastFeaturedBlockBySeller.get(item.sellerId) !== block - 1;
    });
    candidates.sort((left, right) => left.organicIndex - right.organicIndex || left.id.localeCompare(right.id));
    const featured = candidates[0] ?? null;
    if (featured) lastFeaturedBlockBySeller.set(featured.sellerId, block);
    for (const item of natural) output.push(Object.freeze({ ...item,
      premiumPlacement: item.id === featured?.id,
      premiumLabel: item.id === featured?.id ? "Destaque" : null }));
    block += 1;
  }
  return Object.freeze(output);
}
