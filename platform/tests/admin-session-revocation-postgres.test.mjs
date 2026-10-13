import assert from "node:assert/strict";
import test from "node:test";
import { createAdminService } from "../apps/api/admin-service.js";
import { createApiServer } from "../apps/api/server.js";
import { loadConfig } from "../apps/api/config.js";
import { createAdminRepository } from "../database/admin-repository.js";
import { createDatabase } from "../database/client.js";
import { discoverMigrations, migrate } from "../database/migrate.js";
import { nativePostgresTools, withNativeTestPostgres } from "../tools/native-postgres.mjs";

const native = await nativePostgresTools();
const userId = "11111111-1111-4111-8111-111111111111";
const currentSessionId = "22222222-2222-4222-8222-222222222222";
const oldSessionId = "33333333-3333-4333-8333-333333333333";

test("admin revokes other sessions over HTTP and PostgreSQL while preserving the current session", {
  skip: !native && !process.env.CI ? "PostgreSQL nativo ausente neste ambiente." : false,
  timeout: 60000,
}, async () => {
  await withNativeTestPostgres(async databaseUrl => {
    const database = createDatabase({ databaseUrl, databaseSsl: false });
    let api;
    try {
      await migrate(database, await discoverMigrations());
      await database.query(
        `INSERT INTO users(id,email,password_hash,display_name,role)
         VALUES($1,'session-admin@example.test','synthetic-unusable-hash','Admin de sessões fictício','admin')`, [userId]);
      await database.query(
        `INSERT INTO sessions(id,user_id,token_hash,expires_at,user_agent)
         VALUES($1,$3,decode('01','hex'),now()+interval '1 hour','current-test-agent'),
               ($2,$3,decode('02','hex'),now()+interval '1 hour','old-test-agent')`,
        [currentSessionId, oldSessionId, userId]);
      const sessionsByToken = new Map([["current-admin-session", currentSessionId], ["old-admin-session", oldSessionId]]);
      const authService = { async session(token) {
        const sessionId = sessionsByToken.get(token);
        if (!sessionId) return null;
        const row = (await database.query(
          `SELECT u.id,u.role,u.display_name,s.id AS session_id FROM sessions s JOIN users u ON u.id=s.user_id
           WHERE s.id=$1 AND s.revoked_at IS NULL AND s.expires_at>now()`, [sessionId])).rows[0];
        return row ? { id:row.id, role:row.role, displayName:row.display_name, sessionId:row.session_id } : null;
      } };
      api = createApiServer({ config:loadConfig({ NODE_ENV:"test", RATE_LIMIT_MAX:"1000" }), authService,
        adminService:createAdminService(createAdminRepository(database)) });
      await new Promise(resolve => api.listen(0,"127.0.0.1",resolve));
      const origin = `http://127.0.0.1:${api.address().port}`;
      const currentHeaders = { cookie:"fc_session=current-admin-session" };
      const before = await fetch(`${origin}/v1/admin/sessions`, { headers:currentHeaders });
      assert.equal(before.status, 200);
      const beforeItems = (await before.json()).items;
      assert.equal(beforeItems.length, 2);
      assert.equal(beforeItems.filter(item => item.current).length, 1);
      const revoked = await fetch(`${origin}/v1/admin/sessions/revoke-others`, { method:"POST", headers:currentHeaders });
      assert.equal(revoked.status, 200);
      assert.equal((await revoked.json()).revokedCount, 1);
      const after = await fetch(`${origin}/v1/admin/sessions`, { headers:currentHeaders });
      assert.equal(after.status, 200);
      const afterItems = (await after.json()).items;
      assert.equal(afterItems.length, 1);
      assert.equal(afterItems[0].id, currentSessionId);
      assert.equal(afterItems[0].current, true);
      const oldAccess = await fetch(`${origin}/v1/admin/sessions`, { headers:{ cookie:"fc_session=old-admin-session" } });
      assert.equal(oldAccess.status, 401);
      const persisted = await database.query("SELECT id,revoked_at FROM sessions ORDER BY id");
      assert.equal(persisted.rows.find(item => item.id === currentSessionId).revoked_at, null);
      assert.ok(persisted.rows.find(item => item.id === oldSessionId).revoked_at instanceof Date);
      const audit = await database.query("SELECT metadata FROM audit_events WHERE action='sessions.others.revoked' AND actor_user_id=$1", [userId]);
      assert.equal(audit.rows.length, 1);
      assert.equal(audit.rows[0].metadata.revokedCount, 1);
    } finally {
      if (api?.listening) await new Promise(resolve => api.close(resolve));
      await database.close();
    }
  });
});
