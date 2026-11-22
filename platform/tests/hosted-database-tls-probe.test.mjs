import assert from "node:assert/strict";
import test from "node:test";
import { HOSTED_TLS_QUERY, evaluateHostedTlsSession, runHostedTlsProbe } from "../tools/hosted-database-tls-probe.mjs";

const CA = "-----BEGIN CERTIFICATE-----\nsynthetic-only\n-----END CERTIFICATE-----";
const BASE = Object.freeze({
  NODE_ENV: "test",
  HOSTED_TLS_PROBE_APPROVED: "READ_ONLY_HOMOLOGATION",
  SUPABASE_INFRASTRUCTURE_ENABLED: "true",
  DATABASE_SSL: "true",
  DATABASE_SSL_CA: CA,
  DATABASE_URL: "postgresql://postgres:synthetic@db.urbrtnenrsjvgqjhfhdj.supabase.co:5432/postgres",
  PILOT_BH_ENABLED: "false",
});
const SESSION = Object.freeze({
  database_name: "postgres",
  server_ssl: "on",
  tls_active: true,
  tls_version: "TLSv1.3",
  cipher_bits: 256,
});

test("hosted probe uses only a read-only current-backend SSL view", () => {
  assert.match(HOSTED_TLS_QUERY, /pg_catalog\.pg_stat_ssl/);
  assert.match(HOSTED_TLS_QUERY, /pg_backend_pid\(\)/);
  assert.doesNotMatch(HOSTED_TLS_QUERY, /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|SELECT\s+\*)\b/i);
  assert.doesNotMatch(HOSTED_TLS_QUERY, /\b(users|listings|transactions|password|recipient)\b/i);
});

test("hosted probe requires explicit approval and correct BR/CA config before opening pool", async () => {
  let called = 0;
  const createDb = () => { called++; throw new Error("must not connect"); };
  for (const env of [
    { ...BASE, HOSTED_TLS_PROBE_APPROVED: undefined },
    { ...BASE, NODE_ENV: "production" },
    { ...BASE, PILOT_BH_ENABLED: "true" },
    { ...BASE, SUPABASE_INFRASTRUCTURE_ENABLED: "false" },
    { ...BASE, DATABASE_SSL: "false" },
    { ...BASE, DATABASE_SSL_CA: undefined },
    { ...BASE, DATABASE_URL: "postgresql://postgres:synthetic@db.anotherproject.supabase.co:5432/postgres" },
    { ...BASE, DATABASE_URL: BASE.DATABASE_URL + "?sslmode=disable" },
    { ...BASE, DATABASE_URL: "postgresql://postgres.urbrtnenrsjvgqjhfhdj:synthetic@aws-0-sa-east-1.pooler.supabase.com:6543/postgres" },
  ]) {
    await assert.rejects(runHostedTlsProbe({ env, createDb }), /HOSTED_TLS_PROBE_/);
  }
  assert.equal(called, 0);
});

test("hosted probe reuses API config, checks the session and closes the pool", async () => {
  let config, queries = [], closes = 0;
  const proof = await runHostedTlsProbe({
    env: BASE,
    createDb: value => {
      config = value;
      return {
        async query(sql) { queries.push(sql); return { rows: [{ ...SESSION }] }; },
        async close() { closes++; },
      };
    },
  });
  assert.equal(config.databaseSsl, true);
  assert.equal(config.databaseSslCa, CA);
  assert.equal(config.supabaseInfrastructureEnabled, true);
  assert.equal(queries.length, 1);
  assert.equal(queries[0], HOSTED_TLS_QUERY);
  assert.equal(closes, 1);
  assert.equal(proof.status, "PASS_CLIENT_TLS_ONLY");
  assert.equal(proof.tlsVersion, "TLSv1.3");
  assert.equal(proof.cipherBits, 256);
  assert.equal(proof.scope.includes("no backup"), true);
  assert.equal(proof.projectReference, "urbrtnenrsjvgqjhfhdj");
  assert.match(proof.checkedAtUtc, /^\d{4}-\d\d-\d\dT/);
  assert.equal(JSON.stringify(proof).includes("synthetic"), false);
});

test("hosted probe fails closed on incorrect SSL evidence, without declaring backup", () => {
  for (const rows of [
    [], [{ ...SESSION, database_name: "other" }],
    [{ ...SESSION, server_ssl: "off" }],
    [{ ...SESSION, tls_active: false }],
    [{ ...SESSION, tls_version: null }],
    [{ ...SESSION, tls_version: "TLSv1.1" }],
    [{ ...SESSION, cipher_bits: 40 }],
    [{ ...SESSION, cipher_bits: "256" }],
    [SESSION, SESSION],
  ]) {
    assert.throws(() => evaluateHostedTlsSession(rows), /HOSTED_TLS_/);
  }
  assert.equal(evaluateHostedTlsSession([{ ...SESSION, tls_version: "TLSv1.2", cipher_bits: 128 }]).status, "PASS_CLIENT_TLS_ONLY");
});

test("database query errors propagate to caller while connection closes", async () => {
  let closed = false;
  await assert.rejects(runHostedTlsProbe({
    env: BASE,
    createDb: () => ({
      async query() { throw new Error("synthetic-network-failure"); },
      async close() { closed = true; },
    }),
  }), /synthetic-network-failure/);
  assert.equal(closed, true);
});
