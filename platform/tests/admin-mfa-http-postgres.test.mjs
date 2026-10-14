import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../apps/api/server.js";
import { createAuthService } from "../apps/api/auth-service.js";
import { loadConfig } from "../apps/api/config.js";
import { hashPassword } from "../apps/api/security.js";
import { createAuthRepository } from "../database/auth-repository.js";
import { createDatabase } from "../database/client.js";
import { discoverMigrations, migrate } from "../database/migrate.js";
import { nativePostgresTools, withNativeTestPostgres } from "../tools/native-postgres.mjs";

const native = await nativePostgresTools();
const userId = "11111111-1111-4111-8111-111111111111";
const email = "mfa-http-admin@example.test";
const password = "senha-administrativa-sintetica-2026";

test("admin HTTP login requires a single-use PostgreSQL MFA challenge before creating a session", {
  skip: !native && !process.env.CI ? "PostgreSQL nativo ausente neste ambiente." : false,
  timeout: 60000,
}, async () => {
  await withNativeTestPostgres(async databaseUrl => {
    const database = createDatabase({ databaseUrl, databaseSsl: false });
    let api;
    try {
      await migrate(database, await discoverMigrations());
      await database.query(
        `INSERT INTO users(id,email,password_hash,display_name,role,email_verified_at)
         VALUES($1,$2,$3,'Admin MFA fictício','admin',now())`,
        [userId, email, await hashPassword(password)],
      );
      const authService = createAuthService(createAuthRepository(database));
      api = createApiServer({ config:loadConfig({ NODE_ENV:"test", RATE_LIMIT_MAX:"1000" }), authService });
      await new Promise(resolve => api.listen(0,"127.0.0.1",resolve));
      const origin = `http://127.0.0.1:${api.address().port}`;
      const jsonHeaders = { "content-type":"application/json", "user-agent":"synthetic-admin-mfa-test" };

      const login = await fetch(`${origin}/v1/auth/login`, {
        method:"POST", headers:jsonHeaders, body:JSON.stringify({ email, password }),
      });
      assert.equal(login.status, 202);
      assert.equal(login.headers.get("set-cookie"), null);
      const challenge = await login.json();
      assert.equal(challenge.mfaRequired, true);
      assert.match(challenge.challenge, /^[A-Za-z0-9_-]{43}$/);
      assert.equal((await database.query("SELECT count(*)::int AS count FROM sessions WHERE user_id=$1",[userId])).rows[0].count, 0);
      const notification = (await database.query(
        `SELECT payload->>'token' AS code FROM notification_outbox
         WHERE recipient=$1 AND kind='admin_login_mfa' ORDER BY created_at DESC,id DESC LIMIT 1`, [email])).rows[0];
      assert.match(notification.code, /^\d{6}$/);
      const wrongCode = String((Number(notification.code) + 1) % 1_000_000).padStart(6,"0");
      const wrong = await fetch(`${origin}/v1/auth/mfa/confirm`, {
        method:"POST", headers:jsonHeaders, body:JSON.stringify({ challenge:challenge.challenge, code:wrongCode }),
      });
      assert.equal(wrong.status, 422);
      assert.equal(wrong.headers.get("set-cookie"), null);

      const confirm = await fetch(`${origin}/v1/auth/mfa/confirm`, {
        method:"POST", headers:jsonHeaders, body:JSON.stringify({ challenge:challenge.challenge, code:notification.code }),
      });
      assert.equal(confirm.status, 200);
      const confirmed = await confirm.json();
      assert.equal(confirmed.user.role, "admin");
      const cookie = confirm.headers.get("set-cookie").split(";",1)[0];
      const session = await fetch(`${origin}/v1/auth/session`, { headers:{ cookie } });
      assert.equal(session.status, 200);
      assert.equal((await session.json()).user.id, userId);

      const reuse = await fetch(`${origin}/v1/auth/mfa/confirm`, {
        method:"POST", headers:jsonHeaders, body:JSON.stringify({ challenge:challenge.challenge, code:notification.code }),
      });
      assert.equal(reuse.status, 422);
      assert.equal((await database.query("SELECT count(*)::int AS count FROM sessions WHERE user_id=$1",[userId])).rows[0].count, 1);
      const token = (await database.query(
        "SELECT consumed_at FROM auth_tokens WHERE user_id=$1 AND kind='admin_login_mfa' ORDER BY created_at DESC LIMIT 1", [userId])).rows[0];
      assert.ok(token.consumed_at instanceof Date);
    } finally {
      if (api?.listening) await new Promise(resolve => api.close(resolve));
      await database.close();
    }
  });
});
