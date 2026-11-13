import assert from "node:assert/strict";
import test from "node:test";
import { assessSupabaseReadiness } from "../tools/supabase-readiness.mjs";

test("Supabase stays inert without explicit activation", () => {
  assert.deepEqual(assessSupabaseReadiness({}), {
    enabled: false, ready: true,
    checks: [{ name: "activation", passed: true, detail: "Supabase permanece desativado; nenhuma integração externa será usada." }],
  });
});

test("approved database posture keeps FraldaCycle API and auth in control", () => {
  const result = assessSupabaseReadiness({
    SUPABASE_INFRASTRUCTURE_ENABLED: "true",
    DATABASE_URL: "postgresql://postgres.project:secret@aws-0-sa-east-1.pooler.supabase.com:5432/postgres",
    DATABASE_SSL: "true",
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
    "database-url", "database-ssl", "persistent-pool", "data-api-disabled", "auth-disabled",
    "storage-gated", "no-public-secret",
  ]);
});
