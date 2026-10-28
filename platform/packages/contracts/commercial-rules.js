export function cents(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("Invalid amount in cents");
  return value;
}

function percent(value, basisPoints) {
  return Number((BigInt(cents(value)) * BigInt(basisPoints) + 5000n) / 10000n);
}

export function saleSplit(productCents) {
  const platformCents = percent(productCents, 800);
  return { productCents, platformCents, sellerCents: productCents - platformCents };
}

export function exchangeFee(offeredPackageCents) {
  return percent(offeredPackageCents, 250);
}

export function deliverySplit(freightCents) {
  const platformCents = percent(freightCents, 500);
  return {
    freightCents,
    platformCents,
    customerTotalCents: freightCents + platformCents,
    courierCents: freightCents,
  };
}

export function externalPartnerDeliveryCharge(partnerServiceCents) {
  const platformCents = percent(partnerServiceCents, 500);
  return {
    partnerServiceCents,
    platformCents,
    customerTotalCents: partnerServiceCents + platformCents,
    partnerCents: partnerServiceCents,
  };
}

export function freightResponsibility(kind, { subsidyApproved = false } = {}) {
  if (subsidyApproved) return "platform_subsidy";
  if (kind === "sale") return "buyer";
  if (kind === "exchange") return "receiving_participant_per_leg";
  if (kind === "donation") return "beneficiary";
  throw new RangeError("Invalid transaction kind for freight responsibility");
}

export function parsePrice(value) {
  const text = String(value ?? "").trim().replace(/^R\$\s*/, "");
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.replaceAll(".", "").split(",");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function listingPrice(draft) {
  if ((draft.kind ?? "sale") !== "sale") return null;
  if (!Number.isSafeInteger(draft.priceCents) || draft.priceCents <= 0) {
    throw new RangeError("Informe um preço válido na etapa 5 antes de publicar.");
  }
  return draft.priceCents;
}
