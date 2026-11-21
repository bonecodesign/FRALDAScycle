const TLS_QUERY_PARAMETERS = new Set([
  "ssl", "sslcert", "sslcrl", "sslkey", "sslmode", "sslnegotiation", "sslrootcert",
  "uselibpqcompat",
]);
const SUPABASE_PROJECT_REFERENCE = "urbrtnenrsjvgqjhfhdj";

const CERTIFICATE_PATTERN = /^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----\s*$/;

function parseDatabaseUrl(value) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("DATABASE_URL must be a valid PostgreSQL URL"); }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol");
  }
  if (!parsed.hostname || !parsed.username || parsed.pathname.length <= 1) {
    throw new Error("DATABASE_URL must include host, user and database");
  }
  return parsed;
}

export function inspectDatabaseTransport(databaseUrl) {
  const parsed = parseDatabaseUrl(databaseUrl);
  const queryParameters = [...parsed.searchParams.keys()].map(key => key.toLowerCase());
  const tlsParameters = queryParameters.filter(key => TLS_QUERY_PARAMETERS.has(key));
  return Object.freeze({
    hostname: parsed.hostname.toLowerCase(),
    port: parsed.port,
    username: decodeURIComponent(parsed.username),
    tlsParameters: Object.freeze(tlsParameters),
    queryParameters: Object.freeze(queryParameters),
  });
}

export function databasePoolConfig(config) {
  if (!config.databaseUrl) throw new Error("DATABASE_URL is required to connect to PostgreSQL");
  const parsed = parseDatabaseUrl(config.databaseUrl);
  const transport = inspectDatabaseTransport(config.databaseUrl);
  if (transport.tlsParameters.length > 0) {
    throw new Error("DATABASE_URL must not control TLS; use DATABASE_SSL and DATABASE_SSL_CA");
  }
  if (transport.queryParameters.length > 0) {
    throw new Error("DATABASE_URL query parameters are not supported by the API database client");
  }
  const certificateAuthority = config.databaseSslCa?.trim() || null;
  if (certificateAuthority && !CERTIFICATE_PATTERN.test(certificateAuthority)) {
    throw new Error("DATABASE_SSL_CA must contain a PEM certificate");
  }
  if (config.supabaseInfrastructureEnabled && (!config.databaseSsl || !certificateAuthority)) {
    throw new Error("Supabase infrastructure requires DATABASE_SSL=true and DATABASE_SSL_CA");
  }
  if (config.supabaseInfrastructureEnabled) {
    const expectedProject = transport.hostname === `db.${SUPABASE_PROJECT_REFERENCE}.supabase.co` ||
      transport.username.endsWith(`.${SUPABASE_PROJECT_REFERENCE}`);
    const supabaseHost = transport.hostname.endsWith(".supabase.co") ||
      transport.hostname.endsWith(".pooler.supabase.com");
    if (!supabaseHost || !expectedProject) {
      throw new Error("Supabase infrastructure must use the FraldaCycle-BR project");
    }
    if (transport.port === "6543") {
      throw new Error("Persistent API connections must not use transaction pool port 6543");
    }
  }

  return Object.freeze({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    database: decodeURIComponent(parsed.pathname.slice(1)),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    ssl: config.databaseSsl ? Object.freeze({
      rejectUnauthorized: true,
      ...(certificateAuthority ? { ca: certificateAuthority } : {}),
    }) : false,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "fraldacycle-api",
  });
}
