const SECRET_KEY_PATTERN = /^[A-Z][A-Z0-9_]{1,127}$/;

export async function resolveRuntimeEnv(env = process.env, { fetchImpl = fetch } = {}) {
  const endpoint = env.SECRETS_PROVIDER_URL;
  const token = env.SECRETS_PROVIDER_TOKEN;
  const keys = String(env.SECRETS_PROVIDER_KEYS ?? "")
    .split(",").map((key) => key.trim()).filter(Boolean);

  if (!endpoint && !token && keys.length === 0) return env;
  if (!endpoint || !token || keys.length === 0) {
    throw new Error("SECRETS_PROVIDER_URL, SECRETS_PROVIDER_TOKEN and SECRETS_PROVIDER_KEYS must be configured together");
  }
  const url = new URL(endpoint);
  if (url.protocol !== "https:") throw new Error("SECRETS_PROVIDER_URL must use HTTPS");
  if (keys.some((key) => !SECRET_KEY_PATTERN.test(key)) || new Set(keys).size !== keys.length) {
    throw new Error("SECRETS_PROVIDER_KEYS contains an invalid or duplicate key");
  }

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

  const payload = await response.json();
  const resolved = { ...env };
  for (const key of keys) {
    const value = payload?.secrets?.[key];
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`External secrets provider did not return ${key}`);
    }
    resolved[key] = value;
  }
  return resolved;
}
