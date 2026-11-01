function declared(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 100_000_000;
}

export function exchangeDifference({
  requesterId,
  ownerId,
  requesterDeclaredValueCents,
  ownerDeclaredValueCents,
}) {
  if (!requesterId || !ownerId || requesterId === ownerId
      || !declared(requesterDeclaredValueCents) || !declared(ownerDeclaredValueCents)) {
    throw new Error("invalid_exchange_difference");
  }
  if (requesterDeclaredValueCents === ownerDeclaredValueCents) return null;
  const requesterPays = requesterDeclaredValueCents < ownerDeclaredValueCents;
  const lowerValueCents = Math.min(requesterDeclaredValueCents, ownerDeclaredValueCents);
  const higherValueCents = Math.max(requesterDeclaredValueCents, ownerDeclaredValueCents);
  return Object.freeze({
    payerId: requesterPays ? requesterId : ownerId,
    recipientId: requesterPays ? ownerId : requesterId,
    lowerValueCents,
    higherValueCents,
    amountCents: higherValueCents - lowerValueCents,
    status: "not_charged",
    releasePolicy: "after_bilateral_delivery_confirmation",
  });
}
