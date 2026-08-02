export const SURFACES = Object.freeze({
  site: Object.freeze({
    basePath: "/site",
    routes: ["home", "search", "map", "detail", "seller", "favorites", "publish", "impact", "help", "auth"],
  }),
  app: Object.freeze({
    basePath: "/app",
    routes: ["auth", "otp", "home", "search", "map", "publish", "chat", "proposal", "reservation", "payment", "wallet", "refund", "logistics", "profile", "notifications", "moderation", "courier", "global-states"],
  }),
  admin: Object.freeze({
    basePath: "/admin",
    routes: ["dashboard", "users", "rbac", "listings", "operations", "finance", "logistics", "security", "audit", "webhooks", "reports", "impact", "infrastructure", "partnerships", "innovation", "launch"],
  }),
});

export function routeFor(surface, route) {
  const contract = SURFACES[surface];
  if (!contract || !contract.routes.includes(route)) {
    throw new TypeError(`Unknown FraldaCycle route: ${surface}/${route}`);
  }
  return `${contract.basePath}/${route}`;
}
