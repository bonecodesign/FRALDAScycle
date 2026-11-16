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
  "RESPONSIBLE_CPF_HMAC_SECRET",
  "ASAAS_SANDBOX_API_KEY",
  "ASAAS_API_KEY",
  "ASAAS_WEBHOOK_ACCESS_TOKEN",
  "LALAMOVE_API_KEY",
  "LALAMOVE_API_SECRET",
  "LOGGI_QUOTE_PROVIDER_SECRET",
  "UBER_DIRECT_QUOTE_PROVIDER_SECRET",
  "GOOGLE_MAPS_API_KEY",
  "META_WHATSAPP_ACCESS_TOKEN",
  "PROTECTED_BACKUP_STORAGE_BEARER_TOKEN",
  "WALLET_PAYOUT_PROVIDER_SECRET",
  "WALLET_PAYOUT_WEBHOOK_SECRET",
]);

export function supportedRuntimeSecretKeys(){return Object.freeze([...RUNTIME_SECRET_KEYS].sort());}

export function validateSecretsProviderConfig(env = process.env) {
  const endpoint = env.SECRETS_PROVIDER_URL;
  const token = env.SECRETS_PROVIDER_TOKEN;
  const rawKeys = env.SECRETS_PROVIDER_KEYS ?? "";
  const keys = String(rawKeys).split(",").map((key) => key.trim());

  if (!endpoint && !token && rawKeys === "") return null;
  if (!endpoint || !token || rawKeys === "") {
    throw new Error("SECRETS_PROVIDER_URL, SECRETS_PROVIDER_TOKEN and SECRETS_PROVIDER_KEYS must be configured together");
  }
  if (keys.some((key) => key.length === 0)) {
    throw new Error("SECRETS_PROVIDER_KEYS contains an empty key");
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
      redirect: "error",
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
  // Reject oversized declared responses before parsing; secrets should be small.
  const declaredSize = response.headers?.get?.("content-length");
  if (declaredSize != null && (!/^\d+$/.test(declaredSize) || Number(declaredSize) > 65536)) {
    throw new Error("External secrets provider response exceeds size limit");
  }

  let payload;
  try {
    // Enforce the limit on actual bytes too: Content-Length can be missing or false.
    const reader = response.body?.getReader();
    if (!reader) throw new Error("missing response stream");
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > 65536) throw new Error("response too large");
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total)
    ));
  } catch {
    // Never include response fragments or provider errors in logs.
    throw new Error("External secrets provider returned an invalid or oversized response");
  }
  // The provider contract is a JSON object containing only the secrets map.
  if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      Object.keys(payload).length !== 1 || !Object.hasOwn(payload, "secrets")) {
    throw new Error("External secrets provider returned an unexpected response shape");
  }
  // A provider must not return undeclared keys or override unrelated runtime settings.
  const returned = payload.secrets;
  if (!returned || typeof returned !== "object" || Array.isArray(returned) ||
      Object.keys(returned).length !== keys.length ||
      Object.keys(returned).some((key) => !keys.includes(key))) {
    throw new Error("External secrets provider returned an unexpected key set");
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
