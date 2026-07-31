import assert from "node:assert/strict";
import test from "node:test";

import { APPROVED_FEE_RATES, calculateMarketplaceFees } from "./fees.js";

test("applies the approved 8% sale fee and 5% delivery fee", () => {
  assert.deepEqual(
    calculateMarketplaceFees({ type: "sell", amountCents: 10_000, shippingCents: 2_000 }),
    {
      type: "sell",
      marketplaceFeeCents: 800,
      participantFeesCents: { seller: 800, buyer: 0 },
      deliveryFeeCents: 100,
      totalFeeCents: 900,
    },
  );
});

test("splits the approved 5% swap fee equally between both parties", () => {
  assert.deepEqual(
    calculateMarketplaceFees({ type: "swap", amountCents: 10_000 }),
    {
      type: "swap",
      marketplaceFeeCents: 500,
      participantFeesCents: { proposer: 250, receiver: 250 },
      deliveryFeeCents: 0,
      totalFeeCents: 500,
    },
  );
});

test("keeps donations free while calculating optional delivery separately", () => {
  const fees = calculateMarketplaceFees({ type: "donate", shippingCents: 2_000 });
  assert.equal(fees.marketplaceFeeCents, 0);
  assert.equal(fees.deliveryFeeCents, 100);
  assert.equal(fees.totalFeeCents, 100);
  assert.equal(APPROVED_FEE_RATES.donate, 0);
});
