import { DELIVERY_ROUTE_ORDER } from "./delivery-routing.js";

const ALLOWED_UNAVAILABLE_REASONS = new Set([
  "provider_not_configured",
  "provider_not_homologated",
  "outside_coverage",
  "temporarily_unavailable",
  "eligible_courier_unavailable",
]);

function validQuote(provider, quote, now) {
  return quote?.provider === provider
    && typeof quote.quoteId === "string" && quote.quoteId.trim().length >= 8
    && Number.isSafeInteger(quote.customerTotalCents) && quote.customerTotalCents > 0
    && quote.currency === "BRL"
    && Number.isFinite(Date.parse(quote.expiresAt)) && Date.parse(quote.expiresAt) > now;
}

// Every adapter returns either { available: false, reason } or
// { available: true, quote }. Exceptions stop the chain: an unexpected defect
// must not silently change the provider or price shown to the customer.
export function createDeliveryQuoteOrchestrator({ quoters, now = Date.now }) {
  if (!quoters || typeof quoters !== "object" || typeof now !== "function") {
    throw new Error("Invalid delivery quote orchestrator configuration");
  }

  return Object.freeze({
    async quote(input, { paymentProcessed = false } = {}) {
      if (paymentProcessed) {
        return Object.freeze({
          selected: null,
          quote: null,
          evaluations: Object.freeze([]),
          automaticSwitchAllowed: false,
          supportRequired: true,
          blocker: "paid_transaction_locked",
        });
      }

      const evaluations = [];
      for (const provider of DELIVERY_ROUTE_ORDER) {
        const quoter = quoters[provider];
        if (typeof quoter !== "function") {
          evaluations.push(Object.freeze({ provider, available: false, reason: "provider_not_configured" }));
          continue;
        }
        const result = await quoter(input);
        if (result?.available !== true) {
          const reason = ALLOWED_UNAVAILABLE_REASONS.has(result?.reason)
            ? result.reason : "temporarily_unavailable";
          evaluations.push(Object.freeze({ provider, available: false, reason }));
          continue;
        }
        if (!validQuote(provider, result.quote, now())) {
          throw new Error(`Invalid ${provider} delivery quote`);
        }
        evaluations.push(Object.freeze({ provider, available: true, reason: null }));
        return Object.freeze({
          selected: provider,
          quote: Object.freeze({ ...result.quote }),
          evaluations: Object.freeze(evaluations),
          automaticSwitchAllowed: false,
          supportRequired: false,
          blocker: null,
          payerConfirmationRequired: true,
        });
      }

      return Object.freeze({
        selected: null,
        quote: null,
        evaluations: Object.freeze(evaluations),
        automaticSwitchAllowed: false,
        supportRequired: false,
        blocker: "no_delivery_quote_available",
      });
    },
  });
}
