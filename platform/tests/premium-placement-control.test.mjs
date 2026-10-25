import assert from "node:assert/strict";
import test from "node:test";
import {
  PREMIUM_PLACEMENT_INTERVAL,
  applyPremiumPlacement,
  premiumPlacementEligibility,
} from "../packages/contracts/premium-placement-control.js";

const item = (index, overrides = {}) => ({ id: `listing-${index}`, sellerId: `seller-${index}`,
  status: "published", matchesFilters: true, moderationAllowed: true, duplicateAction: "allow",
  distanceBand: 0, premiumActive: true, ...overrides });

test("Premium never bypasses filters, moderation, duplicate controls or manual ordering", () => {
  for (const [change, blocker] of [
    [{ matchesFilters: false }, "listing_outside_filters"],
    [{ moderationAllowed: false }, "moderation_blocked"],
    [{ duplicateAction: "review" }, "duplicate_control_blocked"],
  ]) assert.ok(premiumPlacementEligibility(item(1, change)).blockers.includes(blocker));
  const gate = premiumPlacementEligibility(item(1), { manualSort: true });
  assert.equal(gate.eligible, false);
  assert.equal(gate.paidOverrideAllowed, false);
  assert.equal(gate.qualityOverrideAllowed, false);
});

test("at most one clearly labeled highlight appears in each block of five", () => {
  const result = applyPremiumPlacement(Array.from({ length: 12 }, (_, index) => item(index + 1)));
  assert.equal(PREMIUM_PLACEMENT_INTERVAL, 5);
  for (let start = 0; start < result.length; start += 5) {
    assert.ok(result.slice(start, start + 5).filter(entry => entry.premiumPlacement).length <= 1);
  }
  assert.ok(result.filter(entry => entry.premiumPlacement).every(entry => entry.premiumLabel === "Destaque"));
});

test("a highlight cannot jump more than one geographic band", () => {
  const result = applyPremiumPlacement([
    item(1, { premiumActive: false, distanceBand: 0 }),
    item(2, { distanceBand: 2 }), item(3, { distanceBand: 1 }), item(4), item(5),
  ]);
  assert.equal(result.find(entry => entry.id === "listing-2").premiumPlacement, false);
  assert.equal(result.find(entry => entry.id === "listing-3").premiumPlacement, true);
});

test("seller rotation prevents consecutive highlighted blocks when alternatives exist", () => {
  const listings = Array.from({ length: 10 }, (_, index) => item(index + 1, {
    sellerId: index === 0 || index === 5 ? "seller-repeat" : `seller-${index}`,
    premiumActive: index === 0 || index === 5 || index === 6,
  }));
  const result = applyPremiumPlacement(listings);
  assert.equal(result[0].premiumPlacement, true);
  assert.equal(result[5].premiumPlacement, false);
  assert.equal(result[6].premiumPlacement, true);
});

test("manual sort preserves exact organic order and removes paid placement", () => {
  const input = [item(3), item(1), item(2)];
  const result = applyPremiumPlacement(input, { manualSort: true });
  assert.deepEqual(result.map(entry => entry.id), input.map(entry => entry.id));
  assert.ok(result.every(entry => entry.premiumPlacement === false));
});
