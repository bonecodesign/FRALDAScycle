import { saleSplit, externalPartnerDeliveryCharge } from "./commercial-rules.js";

// Checks local evidence only. It never verifies funds or authorizes a transfer.
export function prepareFreightLinkedPayout(row, kind) {
  if (!["seller", "courier"].includes(kind)) throw new RangeError("Unknown payout kind");
  const blockers = [];
  const active = Boolean(row?.active_quote_id);
  const linked = Boolean(row?.freight_settlement_plan_id);
  if (active && !linked) blockers.push("freight_plan_required");
  if (linked && !active) blockers.push("freight_quote_unavailable");

  if (!linked) {
    if (kind === "seller") {
      if (!Number.isSafeInteger(row?.amount_cents) || row.amount_cents <= 0
        || row.delivery_fee_cents !== 0
        || row.platform_fee_cents + row.seller_amount_cents !== row.amount_cents) {
        blockers.push("payment_split_invalid");
      }
      return Object.freeze({ blockers, freightPlanId: null, grossProductCents: row?.amount_cents,
        productPlatformFeeCents: row?.platform_fee_cents, sellerAmountCents: row?.seller_amount_cents });
    }
    if (!Number.isSafeInteger(row?.delivery_fee_cents) || row.delivery_fee_cents <= 0) {
      blockers.push("freight_not_charged");
    }
    const legacyFee = Number.isSafeInteger(row?.delivery_fee_cents)
      ? Math.floor((row.delivery_fee_cents * 500 + 5000) / 10000) : 0;
    return Object.freeze({
      blockers, freightPlanId: null,
      freightCents: row?.delivery_fee_cents, platformFeeCents: legacyFee,
      courierAmountCents: row?.delivery_fee_cents - legacyFee,
    });
  }

  if (row.active_quote_status !== "locked" ||
    row.active_quote_confirmed_by !== row.buyer_id ||
    row.freight_plan_payer_id !== row.buyer_id ||
    row.active_quote_provider !== row.freight_plan_provider ||
    row.active_quote_base_cents !== row.freight_provider_amount_cents ||
    row.active_quote_platform_fee_cents !== row.freight_plan_platform_fee_cents ||
    row.active_quote_total_cents !== row.freight_plan_total_cents ||
    row.active_quote_shipment_id != null) {
    blockers.push("freight_plan_quote_mismatch");
  }
  const base = row.freight_provider_amount_cents;
  const fee = row.freight_plan_platform_fee_cents;
  const total = row.freight_plan_total_cents;
  if (!Number.isSafeInteger(base) || base <= 0
    || !Number.isSafeInteger(fee) || !Number.isSafeInteger(total)) {
    blockers.push("freight_plan_amount_invalid");
  } else {
    const computed = externalPartnerDeliveryCharge(base);
    if (computed.platformCents !== fee || computed.customerTotalCents !== total) {
      blockers.push("freight_plan_amount_invalid");
    }
  }
  const product = row.product_amount_cents;
  if (!Number.isSafeInteger(product) || product <= 0) {
    blockers.push("product_amount_invalid");
  } else if (Number.isSafeInteger(total)) {
    const sale = saleSplit(product);
    if (!Number.isSafeInteger(product + total) || product + total > 2147483647
      || row.amount_cents !== product + total
      || row.platform_fee_cents !== sale.platformCents + fee
      || row.delivery_fee_cents !== base
      || row.seller_amount_cents !== sale.sellerCents) {
      blockers.push("payment_split_mismatch");
    }
  }
  if (kind === "courier" && row.freight_plan_provider !== "fraldacycle_courier") {
    blockers.push("external_partner_courier_payout_forbidden");
  }
  if (kind === "seller") {
    const sale = Number.isSafeInteger(product) && product > 0
      ? saleSplit(product) : { platformCents: null, sellerCents: null };
    return Object.freeze({
      blockers, freightPlanId: row.freight_settlement_plan_id,
      grossProductCents: product,
      productPlatformFeeCents: sale.platformCents,
      sellerAmountCents: sale.sellerCents,
    });
  }
  return Object.freeze({
    blockers, freightPlanId: row.freight_settlement_plan_id,
    freightCents: total, platformFeeCents: fee, courierAmountCents: base,
  });
}
