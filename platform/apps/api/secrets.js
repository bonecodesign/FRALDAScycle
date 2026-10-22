const SECRET_KEY_PATTERN = /^[A-Z][A-Z0-9_]{1,127}$/;

// The remote resolver may only supply values that are secrets at runtime.
// A vault response must never be able to override general configuration.
const RUNTIME_SECRET_KEYS = new Set([
  "DATABASE_URL",
  "SESSION_SECRET",
  "NOTIFICATION_WEBHOOK_SECRET",
  "MEDIA_PROVIDER_SECRET",
  "GEOCODING_PROVIDER_SECRET",
  "PAYMENT_PROVIDER_SECRET",
  "PAYMENT_WEBHOOK_SECRET",
  "LOGISTICS_PROVIDER_SECRET",
  "LOGISTICS_WEBHOOK_SECRET",
  "RATE_LIMIT_PROVIDER_SECRET",
  "TELEMETRY_PROVIDER_SECRET",
]);

export function validateSecretsProviderConfig(env = process.env) {
  const endpoint = env.SECRETS_PROVIDER_URL;
  const token = env.SECRETS_PROVIDER_TOKEN;
  const keys = String(env.SECRETS_PROVIDER_KEYS ?? "")
    .split(",").map((key) => key.trim()).filter(Boolean);

  if (!endpoint && !token && keys.length === 0) return null;
  if (!endpoint || !token || keys.length === 0) {
    throw new Error("SECRETS_PROVIDER_URL, SECRETS_PROVIDER_TOKEN and SECRETS_PROVIDER_KEYS must be configured together");
  }
  if (typeof token !== "string" || token.trim() !== token || token.length < 8 || /[\u0000-\u001f\u007f]/.test(token)) {
    throw new Error("SECRETS_PROVIDER_TOKEN must be a non-empty opaque token without surrounding whitespace or control characters");
  }
  let url;
  try { url = new URL(endpoint); } catch { throw new Error("SECRETS_PROVIDER_URL must be a valid URL"); }
  if (url.protocol !== "https:") throw new Error("SECRETS_PROVIDER_URL must use HTTPS");
  if (url.username || url.password) throw new Error("SECRETS_PROVIDER_URL must not contain credentials");
  if (url.search || url.hash) throw new Error("SECRETS_PROVIDER_URL must not contain query parameters or fragments");
  if (
    keys.some((key) => !SECRET_KEY_PATTERN.test(key) || !RUNTIME_SECRET_KEYS.has(key)) ||
    new Set(keys).size !== keys.length
  ) {
    throw new Error("SECRETS_PROVIDER_KEYS contains an invalid, unsupported or duplicate key");
  }
  return Object.freeze({ url, token, keys: Object.freeze(keys) });
}

export async function resolveRuntimeEnv(env = process.env, { fetchImpl = fetch } = {}) {
  const provider = validateSecretsProviderConfig(env);
  if (!provider) return env;
  const { url, token, keys } = provider;

  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ keys }),
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    throw new Error("External secrets provider is unavailable");
  }
  if (!response.ok) throw new Error("External secrets provider rejected the request");

  let payload;
  try {
    payload = await response.json();
  } catch {
    // Parsing and stream errors may contain fragments of the secret response.
    throw new Error("External secrets provider returned an invalid response");
  }
  const resolved = { ...env };
  for (const key of keys) {
    const value = payload?.secrets?.[key];
    if (typeof value !== "string" || value.length === 0 || value.trim().length === 0 || /[\u0000\r\n]/.test(value)) {
      throw new Error(`External secrets provider did not return ${key}`);
    }
    resolved[key] = value;
  }
  return resolved;
}
