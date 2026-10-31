import { isMainModule } from "../packages/contracts/main-module.js";

// This gate describes the repository's current pre-activation posture. It is
// intentionally stricter than loadConfig: acknowledgements and credentials do
// not authorize a real operation while the project remains NO-GO.
export const PREACTIVATION_DISABLED_FLAGS = Object.freeze([
  "ACCOUNT_CLOSURE_MAINTENANCE_ENABLED",
  "ASAAS_ENABLED",
  "ASAAS_SANDBOX_ENABLED",
  "CHILD_PROFILES_ENABLED",
  "CHILD_PROFILE_LIFECYCLE_ENABLED",
  "COURIER_ELIGIBILITY_ENABLED",
  "DELIVERY_QUOTE_CHECKOUT_ENABLED",
  "GOOGLE_MAPS_GEOCODING_ENABLED",
  "LALAMOVE_QUOTING_ENABLED",
  "LOGGI_QUOTING_ENABLED",
  "MANUFACTURER_AVAILABILITY_REFRESH_ENABLED",
  "META_WHATSAPP_INCIDENTS_ENABLED",
  "PILOT_BH_ENABLED",
  "PREMIUM_REGULARIZATION_ENABLED",
  "PROTECTED_BACKUP_STORAGE_ENABLED",
  "REFUND_RECONCILIATION_ENABLED",
  "REGISTERED_COURIER_QUOTING_ENABLED",
  "RESPONSIBLE_REGISTRATION_ENABLED",
  "UBER_DIRECT_QUOTING_ENABLED",
]);

export const PREACTIVATION_PRODUCTION_ENVIRONMENTS = Object.freeze([
  "ASAAS_ENVIRONMENT",
  "LALAMOVE_ENVIRONMENT",
]);

export function inspectPreactivationSafety(env = process.env) {
  const enabledFlags = PREACTIVATION_DISABLED_FLAGS.filter((key) => env[key] === "true");
  const productionProviders = PREACTIVATION_PRODUCTION_ENVIRONMENTS.filter(
    (key) => env[key] === "production",
  );
  const blockers = [
    ...enabledFlags.map((key) => `${key} must remain false before formal activation`),
    ...productionProviders.map((key) => `${key} must not select production before formal activation`),
  ];

  return Object.freeze({
    safe: blockers.length === 0,
    mode: "preactivation",
    checkedFlags: PREACTIVATION_DISABLED_FLAGS.length,
    enabledFlags: Object.freeze(enabledFlags),
    productionProviders: Object.freeze(productionProviders),
    blockers: Object.freeze(blockers),
  });
}

if (isMainModule(import.meta.url)) {
  const report = inspectPreactivationSafety();
  console.log(JSON.stringify(report, null, 2));
  if (!report.safe) process.exitCode = 1;
}
