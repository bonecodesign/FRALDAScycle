export const DELIVERY_ROUTE_ORDER = Object.freeze([
  "lalamove",
  "fraldacycle_courier",
  "loggi_express",
  "uber_direct",
]);

const EXTERNAL = new Set(["lalamove", "loggi_express", "uber_direct"]);

export function selectDeliveryRoute(options, { paymentProcessed = false } = {}) {
  const evaluations = [];
  for (const route of DELIVERY_ROUTE_ORDER) {
    const candidate = options?.[route] ?? {};
    const blockers = [];
    if (candidate.available !== true) blockers.push("unavailable");
    if (EXTERNAL.has(route) && candidate.homologated !== true) blockers.push("provider_not_homologated");
    if (route === "fraldacycle_courier" && candidate.eligibleCourierAvailable !== true) {
      blockers.push("eligible_courier_unavailable");
    }
    evaluations.push(Object.freeze({ route, blockers: Object.freeze(blockers) }));
    if (blockers.length === 0) {
      return Object.freeze({
        selected: route,
        requiresNewQuote: true,
        requiresPayerConfirmation: true,
        automaticSwitchAllowed: !paymentProcessed,
        supportRequired: paymentProcessed,
        evaluations: Object.freeze(evaluations),
      });
    }
  }
  return Object.freeze({
    selected: null,
    requiresNewQuote: false,
    requiresPayerConfirmation: false,
    automaticSwitchAllowed: false,
    supportRequired: paymentProcessed,
    evaluations: Object.freeze(evaluations),
  });
}
