export const PROVIDER_CAPABILITIES = Object.freeze([
  "notifications",
  "media",
  "geocoding",
  "payments",
  "logistics",
  "distributedRateLimit",
  "telemetry",
  "externalSecrets",
]);

export const CREDENTIAL_PATTERN = /(-----BEGIN [A-Z ]+PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}|sk_(live|test)_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16})/;
