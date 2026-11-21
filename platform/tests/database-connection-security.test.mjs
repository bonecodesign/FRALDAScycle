import assert from "node:assert/strict";
import test from "node:test";
import { databasePoolConfig } from "../database/connection-security.js";

const SYNTHETIC_CA = "-----BEGIN CERTIFICATE-----\nsynthetic-test-only\n-----END CERTIFICATE-----";

test("API builds structured Supabase pool config with strict identity verification", () => {
  const result = databasePoolConfig({
    databaseUrl: "postgresql://postgres.urbrtnenrsjvgqjhfhdj:p%40ss@aws-0-sa-east-1.pooler.supabase.com:5432/fraldacycle",
    databaseSsl: true,
    databaseSslCa: SYNTHETIC_CA,
    supabaseInfrastructureEnabled: true,
  });
  assert.equal("connectionString" in result, false);
  assert.equal(result.host, "aws-0-sa-east-1.pooler.supabase.com");
  assert.equal(result.password, "p@ss");
  assert.deepEqual(result.ssl, { rejectUnauthorized: true, ca: SYNTHETIC_CA });
});

test("local disposable PostgreSQL remains available without TLS", () => {
  const result = databasePoolConfig({
    databaseUrl: "postgresql://postgres:postgres@127.0.0.1:5432/fraldacycle",
    databaseSsl: false,
  });
  assert.equal(result.ssl, false);
  assert.equal(result.host, "127.0.0.1");
});

test("API fails closed on URL transport overrides, malformed CA and incomplete Supabase TLS", () => {
  const base = { databaseUrl: "postgresql://user:secret@db.example.test/fraldacycle", databaseSsl: true };
  for (const suffix of ["?sslmode=disable", "?SSLMode=require", "?uselibpqcompat=true", "?sslrootcert=system"]) {
    assert.throws(() => databasePoolConfig({ ...base, databaseUrl: `${base.databaseUrl}${suffix}` }),
      /must not control TLS/);
  }
  assert.throws(() => databasePoolConfig({ ...base, databaseSslCa: "not-a-certificate" }), /PEM certificate/);
  assert.throws(() => databasePoolConfig({ ...base, supabaseInfrastructureEnabled: true }),
    /requires DATABASE_SSL=true and DATABASE_SSL_CA/);
  assert.throws(() => databasePoolConfig({ ...base, databaseSsl: false, databaseSslCa: SYNTHETIC_CA,
    supabaseInfrastructureEnabled: true }), /requires DATABASE_SSL=true and DATABASE_SSL_CA/);
  assert.throws(() => databasePoolConfig({ ...base, databaseSslCa: SYNTHETIC_CA,
    supabaseInfrastructureEnabled: true }), /FraldaCycle-BR project/);
  assert.throws(() => databasePoolConfig({ ...base, databaseUrl:
    "postgresql://postgres.urbrtnenrsjvgqjhfhdj:secret@aws-0-sa-east-1.pooler.supabase.com:6543/postgres",
    databaseSslCa: SYNTHETIC_CA, supabaseInfrastructureEnabled: true }), /port 6543/);
});

test("database errors never echo credentials", () => {
  const secret = "never-echo-this-secret";
  assert.throws(
    () => databasePoolConfig({ databaseUrl: `postgresql://user:${secret}@db.example.test/fraldacycle?sslmode=disable` }),
    error => !error.message.includes(secret),
  );
});
