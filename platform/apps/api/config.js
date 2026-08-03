const REQUIRED_IN_PRODUCTION = ["DATABASE_URL", "SESSION_SECRET"];

function integer(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? "development";
  const paymentProviderUrl = env.PAYMENT_PROVIDER_URL ?? null;
  const paymentProviderSecret = env.PAYMENT_PROVIDER_SECRET ?? null;
  if (Boolean(paymentProviderUrl) !== Boolean(paymentProviderSecret)) {
    throw new Error("PAYMENT_PROVIDER_URL and PAYMENT_PROVIDER_SECRET must be configured together");
  }
  if (paymentProviderUrl && !paymentProviderUrl.startsWith("https://")) {
    throw new Error("PAYMENT_PROVIDER_URL must use HTTPS");
  }
  const telemetryProviderUrl = env.TELEMETRY_PROVIDER_URL ?? null;
  const telemetryProviderSecret = env.TELEMETRY_PROVIDER_SECRET ?? null;
  if (Boolean(telemetryProviderUrl) !== Boolean(telemetryProviderSecret)) {
    throw new Error("TELEMETRY_PROVIDER_URL and TELEMETRY_PROVIDER_SECRET must be configured together");
  }
  if (telemetryProviderUrl && !telemetryProviderUrl.startsWith("https://")) {
    throw new Error("TELEMETRY_PROVIDER_URL must use HTTPS");
  }
  const rateLimitProviderUrl = env.RATE_LIMIT_PROVIDER_URL ?? null;
  const rateLimitProviderSecret = env.RATE_LIMIT_PROVIDER_SECRET ?? null;
  if (Boolean(rateLimitProviderUrl) !== Boolean(rateLimitProviderSecret)) {
    throw new Error("RATE_LIMIT_PROVIDER_URL and RATE_LIMIT_PROVIDER_SECRET must be configured together");
  }
  if (rateLimitProviderUrl && !rateLimitProviderUrl.startsWith("https://")) {
    throw new Error("RATE_LIMIT_PROVIDER_URL must use HTTPS");
  }
  if (nodeEnv === "production") {
    for (const key of REQUIRED_IN_PRODUCTION) {
      if (!env[key]) throw new Error(`Missing required production configuration: ${key}`);
    }
    if ((env.SESSION_SECRET ?? "").length < 32) {
      throw new Error("SESSION_SECRET must contain at least 32 characters");
    }
    for (const key of ["NOTIFICATION_WEBHOOK_URL", "NOTIFICATION_WEBHOOK_SECRET"]) {
      if (!env[key]) throw new Error(`Missing required production configuration: ${key}`);
    }
  }

  return Object.freeze({
    nodeEnv,
    host: env.API_HOST ?? "127.0.0.1",
    port: integer(env.API_PORT, 4200),
    databaseUrl: env.DATABASE_URL ?? null,
    databaseSsl: env.DATABASE_SSL === "true",
    sessionSecret: env.SESSION_SECRET ?? "development-only-session-secret",
    sessionTtlSeconds: integer(env.SESSION_TTL_SECONDS, 2_592_000),
    rateLimitMax: integer(env.RATE_LIMIT_MAX, 120),
    rateLimitWindowSeconds: integer(env.RATE_LIMIT_WINDOW_SECONDS, 60),
    rateLimitProviderUrl,
    rateLimitProviderSecret,
    telemetryProviderUrl,
    telemetryProviderSecret,
    paymentProviderUrl,
    paymentProviderSecret,
    notificationWebhookUrl: env.NOTIFICATION_WEBHOOK_URL ?? null,
    notificationWebhookSecret: env.NOTIFICATION_WEBHOOK_SECRET ?? null,
    mediaProviderUrl: env.MEDIA_PROVIDER_URL ?? null,
    mediaProviderSecret: env.MEDIA_PROVIDER_SECRET ?? null,
    geocodingProviderUrl: env.GEOCODING_PROVIDER_URL ?? null,
    geocodingProviderSecret: env.GEOCODING_PROVIDER_SECRET ?? null,
    corsOrigins: Object.freeze((env.CORS_ORIGINS ?? "")
      .split(",").map((value) => value.trim()).filter(Boolean)),
  });
}
