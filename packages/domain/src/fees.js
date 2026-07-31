const BASIS_POINTS = Object.freeze({
  sell: 800,
  swapParty: 250,
  delivery: 500,
});

function feeFromBasisPoints(amountCents, basisPoints) {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new TypeError("amount must be a non-negative integer in cents");
  }
  return Math.round((amountCents * basisPoints) / 10_000);
}

export function calculateMarketplaceFees({ type, amountCents = 0, shippingCents = 0 }) {
  const deliveryFeeCents = feeFromBasisPoints(shippingCents, BASIS_POINTS.delivery);

  if (type === "sell") {
    const marketplaceFeeCents = feeFromBasisPoints(amountCents, BASIS_POINTS.sell);
    return {
      type,
      marketplaceFeeCents,
      participantFeesCents: { seller: marketplaceFeeCents, buyer: 0 },
      deliveryFeeCents,
      totalFeeCents: marketplaceFeeCents + deliveryFeeCents,
    };
  }

  if (type === "swap") {
    const partyFeeCents = feeFromBasisPoints(amountCents, BASIS_POINTS.swapParty);
    const marketplaceFeeCents = partyFeeCents * 2;
    return {
      type,
      marketplaceFeeCents,
      participantFeesCents: { proposer: partyFeeCents, receiver: partyFeeCents },
      deliveryFeeCents,
      totalFeeCents: marketplaceFeeCents + deliveryFeeCents,
    };
  }

  if (type === "donate" || type === "buy") {
    return {
      type,
      marketplaceFeeCents: 0,
      participantFeesCents: {},
      deliveryFeeCents,
      totalFeeCents: deliveryFeeCents,
    };
  }

  throw new TypeError("type must be buy, sell, swap, or donate");
}

export const APPROVED_FEE_RATES = Object.freeze({
  sell: 0.08,
  swapTotal: 0.05,
  swapPerParty: 0.025,
  delivery: 0.05,
  donate: 0,
});
