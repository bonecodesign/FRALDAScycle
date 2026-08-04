const REQUIRED_IN_PRODUCTION = ["DATABASE_URL", "SESSION_SECRET"];

function integer(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? "development";
  const logisticsProviderUrl = env.LOGISTICS_PROVIDER_URL ?? null;
  const logisticsProviderSecret = env.LOGISTICS_PROVIDER_SECRET ?? null;
  const logisticsWebhookSecret = env.LOGISTICS_WEBHOOK_SECRET ?? null;
  if (Boolean(logisticsProviderUrl) !== Boolean(logisticsProviderSecret)) {
    throw new Error("LOGISTICS_PROVIDER_URL and LOGISTICS_PROVIDER_SECRET must be configured together");
  }
  if (logisticsProviderUrl && !logisticsProviderUrl.startsWith("https://")) {
    throw new Error("LOGISTICS_PROVIDER_URL must use HTTPS");
  }
  if (nodeEnv === "production" && logisticsProviderUrl && !logisticsWebhookSecret) {
    throw new Error("LOGISTICS_WEBHOOK_SECRET is required with a production logistics provider");
  }
  const paymentProviderUrl = env.PAYMENT_PROVIDER_URL ?? null;
  const paymentProviderSecret = env.PAYMENT_PROVIDER_SECRET ?? null;
  const paymentWebhookSecret = env.PAYMENT_WEBHOOK_SECRET ?? null;
  const paymentProviderSdkUrl = env.PAYMENT_PROVIDER_SDK_URL ?? null;
  const paymentProviderSdkIntegrity = env.PAYMENT_PROVIDER_SDK_INTEGRITY ?? null;
  if (Boolean(paymentProviderSdkUrl) !== Boolean(paymentProviderSdkIntegrity)) {
    throw new Error("PAYMENT_PROVIDER_SDK_URL and PAYMENT_PROVIDER_SDK_INTEGRITY must be configured together");
  }
  if (paymentProviderSdkUrl && !paymentProviderSdkUrl.startsWith("https://")) {
    throw new Error("PAYMENT_PROVIDER_SDK_URL must use HTTPS");
  }
  if (paymentProviderSdkIntegrity && !/^sha(256|384|512)-/.test(paymentProviderSdkIntegrity)) {
    throw new Error("PAYMENT_PROVIDER_SDK_INTEGRITY must use SRI");
  }
  if (Boolean(paymentProviderUrl) !== Boolean(paymentProviderSecret)) {
    throw new Error("PAYMENT_PROVIDER_URL and PAYMENT_PROVIDER_SECRET must be configured together");
  }
  if (paymentProviderUrl && !paymentProviderUrl.startsWith("https://")) {
    throw new Error("PAYMENT_PROVIDER_URL must use HTTPS");
  }
  if (nodeEnv === "production" && paymentProviderUrl && !paymentWebhookSecret) {
    throw new Error("PAYMENT_WEBHOOK_SECRET is required with a production payment provider");
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
    logisticsProviderUrl,
    logisticsProviderSecret,
    logisticsWebhookSecret,
    paymentProviderUrl,
    paymentProviderSecret,
    paymentWebhookSecret,
    paymentProviderSdkUrl,
    paymentProviderSdkIntegrity,
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
