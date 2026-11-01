const METHODS = new Set(["pix", "credit"]);
const RAW_CARD = new Set(["cardNumber", "number", "cvv", "cvc", "securityCode", "expiry", "expiration"]);

export function exchangeDifferenceCheckout(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)
      || Object.keys(input).some((key) => RAW_CARD.has(key))) {
    throw new Error("invalid_exchange_difference_checkout");
  }
  const method = String(input.method ?? "").trim();
  const installments = input.installments ?? 1;
  const paymentMethodToken = String(input.paymentMethodToken ?? "").trim() || null;
  if (!METHODS.has(method) || installments !== 1
      || (method === "credit" && !paymentMethodToken)
      || (method === "pix" && paymentMethodToken)) {
    throw new Error("invalid_exchange_difference_checkout");
  }
  return Object.freeze({ method, installments: 1, paymentMethodToken });
}
