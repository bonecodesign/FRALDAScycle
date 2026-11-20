import assert from "node:assert/strict";
import test from "node:test";
import { assessSupabaseReadiness } from "../tools/supabase-readiness.mjs";

const SYNTHETIC_CA = "-----BEGIN CERTIFICATE-----\nsynthetic-test-only\n-----END CERTIFICATE-----";

test("Supabase stays inert without explicit activation", () => {
  assert.deepEqual(assessSupabaseReadiness({}), {
    enabled: false, ready: true,
    checks: [{ name: "activation", passed: true, detail: "Supabase permanece desativado; nenhuma integração externa será usada." }],
  });
});

test("approved database posture keeps FraldaCycle API and auth in control", () => {
  const result = assessSupabaseReadiness({
    SUPABASE_INFRASTRUCTURE_ENABLED: "true",
    DATABASE_URL: "postgresql://postgres.urbrtnenrsjvgqjhfhdj:secret@aws-0-sa-east-1.pooler.supabase.com:5432/postgres",
    DATABASE_SSL: "true",
    DATABASE_SSL_CA: SYNTHETIC_CA,
    SUPABASE_DATA_API_ENABLED: "false",
    SUPABASE_AUTH_ENABLED: "false",
    SUPABASE_REALTIME_ENABLED: "false",
    SUPABASE_STORAGE_ENABLED: "false",
  });
  assert.equal(result.ready, true);
  assert.equal(result.checks.every(check => check.passed), true);
});

test("readiness rejects insecure database, transaction pool and exposed secrets", () => {
  const result = assessSupabaseReadiness({
    SUPABASE_INFRASTRUCTURE_ENABLED: "true",
    DATABASE_URL: "postgresql://postgres:secret@example.com:6543/postgres",
    DATABASE_SSL: "false",
    SUPABASE_AUTH_ENABLED: "true",
    SUPABASE_DATA_API_ENABLED: "true",
    SUPABASE_STORAGE_ENABLED: "true",
    VITE_SUPABASE_SERVICE_ROLE_SECRET: "never-public",
  });
  assert.equal(result.ready, false);
  assert.deepEqual(result.checks.filter(check => !check.passed).map(check => check.name), [
    "database-url", "database-ssl", "database-ca", "persistent-pool", "data-api-disabled", "auth-disabled",
    "storage-gated", "no-public-secret",
  ]);
});

test("readiness rejects every URL-controlled TLS mode and compatibility override", () => {
  const base = {
    SUPABASE_INFRASTRUCTURE_ENABLED: "true",
    DATABASE_SSL: "true",
    DATABASE_SSL_CA: SYNTHETIC_CA,
  };
  for (const parameter of [
    "sslmode=disable", "sslmode=prefer", "sslmode=require", "sslmode=verify-ca",
    "sslmode=verify-full", "sslmode=no-verify", "ssl=false", "uselibpqcompat=true",
    "sslrootcert=system",
  ]) {
    const result = assessSupabaseReadiness({
      ...base,
      DATABASE_URL: `postgresql://postgres.urbrtnenrsjvgqjhfhdj:secret@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?${parameter}`,
    });
    assert.equal(result.ready, false, parameter);
    assert.equal(result.checks.find(check => check.name === "database-tls-source").passed, false, parameter);
  }
});
