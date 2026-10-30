import { pilotBhConfig } from "./pilot-bh.js";

const REQUIRED_IN_PRODUCTION = ["DATABASE_URL", "SESSION_SECRET"];

function integer(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

function httpsProviderPair(env, urlKey, secretKey) {
  const url = env[urlKey] ?? null;
  const secret = env[secretKey] ?? null;
  if (Boolean(url) !== Boolean(secret)) {
    throw new Error(`${urlKey} and ${secretKey} must be configured together`);
  }
  if (url && !url.startsWith("https://")) {
    throw new Error(`${urlKey} must use HTTPS`);
  }
  return { url, secret };
}

function corsOrigins(value, nodeEnv) {
  const origins = String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  if (new Set(origins).size !== origins.length) {
    throw new Error("CORS_ORIGINS must not contain duplicate origins");
  }
  for (const origin of origins) {
    let parsed;
    try { parsed = new URL(origin); } catch { throw new Error("CORS_ORIGINS contains an invalid origin"); }
    if (parsed.origin !== origin || parsed.username || parsed.password) {
      throw new Error("CORS_ORIGINS must contain origins only, without paths or credentials");
    }
    if (nodeEnv === "production" && parsed.protocol !== "https:") {
      throw new Error("CORS_ORIGINS must use HTTPS in production");
    }
    if (!["https:", "http:"].includes(parsed.protocol)) {
      throw new Error("CORS_ORIGINS must use HTTP or HTTPS");
    }
  }
  return Object.freeze(origins);
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? "development";
  const allowedCorsOrigins = corsOrigins(env.CORS_ORIGINS, nodeEnv);
  const notification = httpsProviderPair(
    env, "NOTIFICATION_WEBHOOK_URL", "NOTIFICATION_WEBHOOK_SECRET",
  );
  const media = httpsProviderPair(env, "MEDIA_PROVIDER_URL", "MEDIA_PROVIDER_SECRET");
  const geocoding = httpsProviderPair(
    env, "GEOCODING_PROVIDER_URL", "GEOCODING_PROVIDER_SECRET",
  );
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

  const childProfilesRequested = env.CHILD_PROFILES_ENABLED === "true";
  const childProfilesActivationAcknowledged = env.CHILD_PROFILES_ACTIVATION_ACKNOWLEDGED === "true";
  if (nodeEnv === "production" && childProfilesRequested && !childProfilesActivationAcknowledged) {
    throw new Error("CHILD_PROFILES_ACTIVATION_ACKNOWLEDGED=true is required with CHILD_PROFILES_ENABLED=true in production");
  }
  const responsibleRegistrationEnabled = env.RESPONSIBLE_REGISTRATION_ENABLED === "true";
  const responsibleCpfHmacSecret = env.RESPONSIBLE_CPF_HMAC_SECRET ?? null;
  if (responsibleRegistrationEnabled && String(responsibleCpfHmacSecret ?? "").length < 32) {
    throw new Error("RESPONSIBLE_CPF_HMAC_SECRET must contain at least 32 characters when responsible registration is enabled");
  }
  if (responsibleRegistrationEnabled && responsibleCpfHmacSecret === env.SESSION_SECRET) {
    throw new Error("RESPONSIBLE_CPF_HMAC_SECRET must not reuse SESSION_SECRET");
  }
  const asaasSandboxEnabled=env.ASAAS_SANDBOX_ENABLED==='true';
  const asaasSandboxApiKey=env.ASAAS_SANDBOX_API_KEY??null;
  const asaasEnabled=env.ASAAS_ENABLED==='true'||asaasSandboxEnabled;
  const asaasEnvironment=asaasSandboxEnabled?'sandbox':(env.ASAAS_ENVIRONMENT??'sandbox');
  const asaasApiKey=env.ASAAS_API_KEY??asaasSandboxApiKey;
  const asaasActivationAcknowledged=env.ASAAS_ACTIVATION_ACKNOWLEDGED==='true';
  const asaasWebhookAccessToken=env.ASAAS_WEBHOOK_ACCESS_TOKEN??null;
  if(asaasSandboxEnabled&&nodeEnv==='production')throw new Error('ASAAS_SANDBOX_ENABLED cannot be used in production');
  if(!['sandbox','production'].includes(asaasEnvironment))throw new Error('ASAAS_ENVIRONMENT must be sandbox or production');
  if(asaasEnabled&&(!asaasApiKey||String(asaasWebhookAccessToken??'').length<16))throw new Error('Asaas API key and webhook access token are required when enabled');
  if(nodeEnv==='production'&&asaasEnabled&&(asaasEnvironment!=='production'||!asaasActivationAcknowledged))throw new Error('Production Asaas requires ASAAS_ENVIRONMENT=production and ASAAS_ACTIVATION_ACKNOWLEDGED=true');
  const lalamoveQuotingRequested=env.LALAMOVE_QUOTING_ENABLED==='true';
  const lalamoveActivationAcknowledged=env.LALAMOVE_ACTIVATION_ACKNOWLEDGED==='true';
  const lalamoveApiKey=env.LALAMOVE_API_KEY??null;
  const lalamoveApiSecret=env.LALAMOVE_API_SECRET??null;
  const lalamoveEnvironment=env.LALAMOVE_ENVIRONMENT??'sandbox';
  if(!['sandbox','production'].includes(lalamoveEnvironment))throw new Error('LALAMOVE_ENVIRONMENT must be sandbox or production');
  if(lalamoveQuotingRequested&&(!lalamoveApiKey||!lalamoveApiSecret))throw new Error('Lalamove API key and secret are required when quoting is enabled');
  if(nodeEnv==='production'&&lalamoveQuotingRequested&&!lalamoveActivationAcknowledged)throw new Error('LALAMOVE_ACTIVATION_ACKNOWLEDGED=true is required with LALAMOVE_QUOTING_ENABLED=true in production');
  if(nodeEnv==='production'&&lalamoveQuotingRequested&&lalamoveEnvironment!=='production')throw new Error('LALAMOVE_ENVIRONMENT=production is required for production quoting');
  const loggiQuotingRequested=env.LOGGI_QUOTING_ENABLED==='true';
  const loggiHomologationAcknowledged=env.LOGGI_HOMOLOGATION_ACKNOWLEDGED==='true';
  const loggiQuoteProviderUrl=env.LOGGI_QUOTE_PROVIDER_URL??null;
  const loggiQuoteProviderSecret=env.LOGGI_QUOTE_PROVIDER_SECRET??null;
  if(Boolean(loggiQuoteProviderUrl)!==Boolean(loggiQuoteProviderSecret))throw new Error('LOGGI_QUOTE_PROVIDER_URL and LOGGI_QUOTE_PROVIDER_SECRET must be configured together');
  if(loggiQuoteProviderUrl&&!loggiQuoteProviderUrl.startsWith('https://'))throw new Error('LOGGI_QUOTE_PROVIDER_URL must use HTTPS');
  if(loggiQuotingRequested&&(!loggiQuoteProviderUrl||!loggiHomologationAcknowledged))throw new Error('Loggi quoting requires gateway configuration and homologation acknowledgement');
  const uberDirectQuotingRequested=env.UBER_DIRECT_QUOTING_ENABLED==='true';
  const uberDirectHomologationAcknowledged=env.UBER_DIRECT_HOMOLOGATION_ACKNOWLEDGED==='true';
  const uberDirectQuoteProviderUrl=env.UBER_DIRECT_QUOTE_PROVIDER_URL??null;
  const uberDirectQuoteProviderSecret=env.UBER_DIRECT_QUOTE_PROVIDER_SECRET??null;
  if(Boolean(uberDirectQuoteProviderUrl)!==Boolean(uberDirectQuoteProviderSecret))throw new Error('UBER_DIRECT_QUOTE_PROVIDER_URL and UBER_DIRECT_QUOTE_PROVIDER_SECRET must be configured together');
  if(uberDirectQuoteProviderUrl&&!uberDirectQuoteProviderUrl.startsWith('https://'))throw new Error('UBER_DIRECT_QUOTE_PROVIDER_URL must use HTTPS');
  if(uberDirectQuotingRequested&&(!uberDirectQuoteProviderUrl||!uberDirectHomologationAcknowledged))throw new Error('Uber Direct quoting requires gateway configuration and homologation acknowledgement');
  const deliveryQuoteCheckoutRequested=env.DELIVERY_QUOTE_CHECKOUT_ENABLED==='true';
  const deliveryQuoteCheckoutAcknowledged=env.DELIVERY_QUOTE_CHECKOUT_ACTIVATION_ACKNOWLEDGED==='true';
  const googleMapsGeocodingRequested=env.GOOGLE_MAPS_GEOCODING_ENABLED==='true';
  const googleMapsActivationAcknowledged=env.GOOGLE_MAPS_ACTIVATION_ACKNOWLEDGED==='true';
  const googleMapsApiKey=env.GOOGLE_MAPS_API_KEY??null;
  if(googleMapsGeocodingRequested&&String(googleMapsApiKey??'').length<8)throw new Error('GOOGLE_MAPS_API_KEY is required when geocoding is enabled');
  if(nodeEnv==='production'&&googleMapsGeocodingRequested&&!googleMapsActivationAcknowledged)throw new Error('GOOGLE_MAPS_ACTIVATION_ACKNOWLEDGED=true is required in production');
  if(deliveryQuoteCheckoutRequested&&!googleMapsGeocodingRequested)throw new Error('DELIVERY_QUOTE_CHECKOUT_ENABLED requires GOOGLE_MAPS_GEOCODING_ENABLED=true');
  if(nodeEnv==='production'&&deliveryQuoteCheckoutRequested&&!deliveryQuoteCheckoutAcknowledged)throw new Error('DELIVERY_QUOTE_CHECKOUT_ACTIVATION_ACKNOWLEDGED=true is required in production');
  const courierEligibilityRequested = env.COURIER_ELIGIBILITY_ENABLED === "true";
  const courierEligibilityActivationAcknowledged = env.COURIER_ELIGIBILITY_ACTIVATION_ACKNOWLEDGED === "true";
  if (nodeEnv === "production" && courierEligibilityRequested && !courierEligibilityActivationAcknowledged) {
    throw new Error("COURIER_ELIGIBILITY_ACTIVATION_ACKNOWLEDGED=true is required with COURIER_ELIGIBILITY_ENABLED=true in production");
  }
  const registeredCourierQuotingRequested=env.REGISTERED_COURIER_QUOTING_ENABLED==='true';
  if(registeredCourierQuotingRequested&&!courierEligibilityRequested)throw new Error('REGISTERED_COURIER_QUOTING_ENABLED requires COURIER_ELIGIBILITY_ENABLED=true');
  const courierRetentionPolicyVersion = env.COURIER_CLEARANCE_RETENTION_POLICY_VERSION ?? null;
  const courierRetentionLegalApproverId = env.COURIER_CLEARANCE_RETENTION_LEGAL_APPROVER_ID ?? null;
  if (courierEligibilityRequested && (!courierRetentionPolicyVersion ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(courierRetentionLegalApproverId ?? ""))) {
    throw new Error("Approved courier clearance retention policy configuration is required before activation");
  }

  return Object.freeze({
    nodeEnv,
    host: env.API_HOST ?? "127.0.0.1",
    port: integer(env.API_PORT, 4200, 65_535),
    databaseUrl: env.DATABASE_URL ?? null,
    databaseSsl: env.DATABASE_SSL === "true",
    sessionSecret: env.SESSION_SECRET ?? "development-only-session-secret",
    sessionTtlSeconds: integer(env.SESSION_TTL_SECONDS, 2_592_000, 2_592_000),
    rateLimitMax: integer(env.RATE_LIMIT_MAX, 120, 10_000),
    rateLimitWindowSeconds: integer(env.RATE_LIMIT_WINDOW_SECONDS, 60, 3_600),
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
    notificationWebhookUrl: notification.url,
    notificationWebhookSecret: notification.secret,
    mediaProviderUrl: media.url,
    mediaProviderSecret: media.secret,
    geocodingProviderUrl: geocoding.url,
    geocodingProviderSecret: geocoding.secret,
    childProfilesEnabled: childProfilesRequested && (nodeEnv !== "production" || childProfilesActivationAcknowledged),
    responsibleRegistrationEnabled,
    responsibleCpfHmacSecret,
    asaasSandboxEnabled,
    asaasSandboxApiKey,
    asaasEnabled,
    asaasEnvironment,
    asaasApiKey,
    asaasWebhookAccessToken,
    lalamoveQuotingEnabled:lalamoveQuotingRequested&&(nodeEnv!=='production'||lalamoveActivationAcknowledged),
    lalamoveApiKey,
    lalamoveApiSecret,
    lalamoveEnvironment,
    loggiQuotingEnabled:loggiQuotingRequested&&loggiHomologationAcknowledged,
    loggiQuoteProviderUrl,
    loggiQuoteProviderSecret,
    uberDirectQuotingEnabled:uberDirectQuotingRequested&&uberDirectHomologationAcknowledged,
    uberDirectQuoteProviderUrl,
    uberDirectQuoteProviderSecret,
    deliveryQuoteCheckoutEnabled:deliveryQuoteCheckoutRequested&&(nodeEnv!=='production'||deliveryQuoteCheckoutAcknowledged),
    googleMapsGeocodingEnabled:googleMapsGeocodingRequested&&(nodeEnv!=='production'||googleMapsActivationAcknowledged),
    googleMapsApiKey,
    courierEligibilityEnabled: courierEligibilityRequested &&
      (nodeEnv !== "production" || courierEligibilityActivationAcknowledged),
    registeredCourierQuotingEnabled:registeredCourierQuotingRequested&&courierEligibilityRequested&&
      (nodeEnv!=="production"||courierEligibilityActivationAcknowledged),
    courierClearanceRetentionPolicyVersion: courierRetentionPolicyVersion,
    courierClearanceRetentionLegalApproverId: courierRetentionLegalApproverId,
    courierEligibilityMaintenanceSeconds: Math.max(60,
      integer(env.COURIER_ELIGIBILITY_MAINTENANCE_SECONDS, 300, 3_600)),
    pilotBh: pilotBhConfig(env),
    corsOrigins: allowedCorsOrigins,
  });
}
