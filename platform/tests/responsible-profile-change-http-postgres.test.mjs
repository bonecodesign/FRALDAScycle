import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../apps/api/server.js";
import { loadConfig } from "../apps/api/config.js";
import { hashPassword } from "../apps/api/security.js";
import { createResponsibleProfileChangeService } from "../apps/api/responsible-profile-change-service.js";
import { createDatabase } from "../database/client.js";
import { discoverMigrations, migrate } from "../database/migrate.js";
import { createResponsibleProfileChangeRepository } from "../database/responsible-profile-change-repository.js";
import { nativePostgresTools, withNativeTestPostgres } from "../tools/native-postgres.mjs";

const native = await nativePostgresTools();
const userId = "10000000-0000-4000-8000-000000000066";

test("nome e nascimento do responsável mudam somente após senha e código por e-mail", {
  skip: !native && !process.env.CI ? "PostgreSQL nativo ausente neste ambiente." : false,
  timeout: 60_000,
}, async () => {
  await withNativeTestPostgres(async databaseUrl => {
    const database = createDatabase({ databaseUrl, databaseSsl: false });
    let api;
    try {
      await migrate(database, await discoverMigrations());
      const passwordHash = await hashPassword("uma frase senha segura");
      await database.query(`INSERT INTO users(id,email,email_verified_at,password_hash,display_name,
        legal_name,cpf_fingerprint,adult_birth_date,responsible_truth_version,
        responsible_truth_declared_at,responsible_registration_completed_at)
        VALUES($1,'responsible-change@example.test',now(),$2,'Maria','Maria da Silva',decode($3,'hex'),
          '1990-05-12','FC-RESPONSIBLE-1',now(),now())`, [userId, passwordHash, "a".repeat(64)]);
      const authService = { async session(token) { return token === "responsible-change-session" ? { id: userId, role: "customer" } : null; } };
      const responsibleProfileChangeService = createResponsibleProfileChangeService(
        createResponsibleProfileChangeRepository(database),
      );
      api = createApiServer({ config: loadConfig({ NODE_ENV: "test", RATE_LIMIT_MAX: "1000" }),
        authService, responsibleProfileChangeService });
      await new Promise(resolve => api.listen(0, "127.0.0.1", resolve));
      const origin = `http://127.0.0.1:${api.address().port}`;
      const headers = { cookie: "fc_session=responsible-change-session", "content-type": "application/json" };
      const request = await fetch(`${origin}/v1/account/responsible-profile/change/request`, { method: "POST", headers,
        body: JSON.stringify({ password: "uma frase senha segura",
          change: { fullName: "Maria de Souza", birthDate: "1991-06-13" } }) });
      const requested = await request.json();
      assert.equal(request.status, 202, JSON.stringify(requested));
      assert.match(requested.challenge, /^[A-Za-z0-9_-]{43}$/);
      assert.equal(request.headers.get("cache-control"), "no-store");
      const before = (await database.query("SELECT legal_name,adult_birth_date FROM users WHERE id=$1", [userId])).rows[0];
      assert.equal(before.legal_name, "Maria da Silva");
      const notification = (await database.query(`SELECT payload FROM notification_outbox
        WHERE recipient='responsible-change@example.test' AND kind='responsible_profile_change'`)).rows[0];
      assert.match(notification.payload.token, /^\d{6}$/);

      const mismatched = await fetch(`${origin}/v1/account/responsible-profile/change/confirm`, { method: "POST", headers,
        body: JSON.stringify({ challenge: requested.challenge, code: notification.payload.token,
          change: { fullName: "Outra Pessoa", birthDate: "1985-01-02" } }) });
      assert.equal(mismatched.status, 422);
      assert.equal((await mismatched.json()).error.code, "invalid_responsible_change_code");

      const confirm = await fetch(`${origin}/v1/account/responsible-profile/change/confirm`, { method: "POST", headers,
        body: JSON.stringify({ challenge: requested.challenge, code: notification.payload.token,
          change: { fullName: "Maria de Souza", birthDate: "1991-06-13" } }) });
      assert.equal(confirm.status, 200, await confirm.text());
      const after = (await database.query("SELECT legal_name,adult_birth_date FROM users WHERE id=$1", [userId])).rows[0];
      assert.equal(after.legal_name, "Maria de Souza");
      const date = after.adult_birth_date instanceof Date ? after.adult_birth_date.toISOString().slice(0, 10) : String(after.adult_birth_date);
      assert.equal(date, "1991-06-13");
      const pending = (await database.query(`SELECT encode(change_hash,'hex') AS change_hash,consumed_at
        FROM responsible_profile_change_requests WHERE user_id=$1`, [userId])).rows[0];
      assert.match(pending.change_hash, /^[a-f0-9]{64}$/); assert.ok(pending.consumed_at);
      const audit = (await database.query(`SELECT metadata::text AS metadata FROM audit_events
        WHERE actor_user_id=$1 AND action='account.responsible.profile.changed'`, [userId])).rows[0];
      assert.doesNotMatch(audit.metadata, /Maria|1991-06-13/);
      const reused = await fetch(`${origin}/v1/account/responsible-profile/change/confirm`, { method: "POST", headers,
        body: JSON.stringify({ challenge: requested.challenge, code: notification.payload.token,
          change: { fullName: "Maria de Souza", birthDate: "1991-06-13" } }) });
      assert.equal(reused.status, 422);
    } finally {
      if (api?.listening) await new Promise(resolve => api.close(resolve));
      await database.close();
    }
  });
});
