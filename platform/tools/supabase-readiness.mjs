const TRUE = "true";
const PROJECT_REFERENCE = "urbrtnenrsjvgqjhfhdj";

import { inspectDatabaseTransport } from "../database/connection-security.js";

function configured(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function assessSupabaseReadiness(env = process.env) {
  const enabled = env.SUPABASE_INFRASTRUCTURE_ENABLED === TRUE;
  const checks = [];
  const add = (name, passed, detail) => checks.push(Object.freeze({ name, passed, detail }));

  if (!enabled) {
    add("activation", true, "Supabase permanece desativado; nenhuma integração externa será usada.");
    return Object.freeze({ enabled: false, ready: true, checks: Object.freeze(checks) });
  }

  let databaseUrl;
  let transport;
  try {
    databaseUrl = new URL(env.DATABASE_URL);
    transport = inspectDatabaseTransport(env.DATABASE_URL);
  } catch {}
  const host = databaseUrl?.hostname ?? "";
  const isSupabaseHost = host.endsWith(".supabase.co") || host.endsWith(".pooler.supabase.com");
  const isExpectedProject = host === `db.${PROJECT_REFERENCE}.supabase.co` ||
    transport?.username.endsWith(`.${PROJECT_REFERENCE}`);
  add("database-url", Boolean(databaseUrl) && isSupabaseHost && isExpectedProject,
    "DATABASE_URL deve apontar para o projeto FraldaCycle-BR esperado.");
  add("database-ssl", env.DATABASE_SSL === TRUE,
    "Conexões com o PostgreSQL gerenciado devem exigir TLS.");
  add("database-tls-source", transport?.tlsParameters.length === 0 && transport?.queryParameters.length === 0,
    "A URL não pode sobrescrever o transporte; TLS é controlado somente pela API.");
  add("database-ca", /^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----\s*$/.test(env.DATABASE_SSL_CA ?? ""),
    "A CA oficial deve ser fornecida para validar certificado e identidade do servidor.");
  add("persistent-pool", databaseUrl?.port !== "6543",
    "A API persistente deve usar conexão direta ou pooler em modo session; porta 6543 fica reservada a clientes transitórios.");
  add("data-api-disabled", env.SUPABASE_DATA_API_ENABLED !== TRUE,
    "A Data API permanece desativada; toda autorização continua na API FraldaCycle.");
  add("auth-disabled", env.SUPABASE_AUTH_ENABLED !== TRUE,
    "Supabase Auth permanece desativado para não duplicar sessões, MFA e RBAC.");
  add("realtime-disabled", env.SUPABASE_REALTIME_ENABLED !== TRUE,
    "Realtime permanece desativado até análise específica de privacidade e capacidade.");
  add("storage-gated", env.SUPABASE_STORAGE_ENABLED !== TRUE ||
    (configured(env.MEDIA_PROVIDER_URL) && configured(env.MEDIA_PROVIDER_SECRET)),
  "Storage só pode ser ativado atrás do gateway privado de mídia e nunca diretamente no navegador.");
  add("no-public-secret", !Object.keys(env).some(key =>
    /^(NEXT_PUBLIC|PUBLIC|VITE)_.*(SUPABASE|SERVICE_ROLE|SECRET)/i.test(key) && configured(env[key])),
  "Chaves secretas ou service_role não podem estar em variáveis públicas do frontend.");

  return Object.freeze({ enabled: true, ready: checks.every(check => check.passed), checks: Object.freeze(checks) });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = assessSupabaseReadiness();
  for (const check of result.checks) {
    console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
  }
  if (!result.ready) process.exitCode = 1;
}
