const REQUIRED_IN_PRODUCTION = ["DATABASE_URL", "SESSION_SECRET"];

function integer(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? "development";
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
