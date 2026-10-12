import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../apps/api/server.js";
import { loadConfig } from "../apps/api/config.js";
import { createOperationalControlService } from "../apps/api/operational-control.js";
import { createDatabase } from "../database/client.js";
import { discoverMigrations, migrate } from "../database/migrate.js";
import { createOperationalControlRepository } from "../database/operational-control-repository.js";
import { nativePostgresTools, withNativeTestPostgres } from "../tools/native-postgres.mjs";

const native = await nativePostgresTools();
const adminId = "11111111-1111-4111-8111-111111111111";

test("operational pause and resume are persisted, audited and enforced over HTTP", {
  skip: !native && !process.env.CI ? "PostgreSQL nativo ausente neste ambiente." : false,
  timeout: 60000,
}, async () => {
  await withNativeTestPostgres(async databaseUrl => {
    const database = createDatabase({ databaseUrl, databaseSsl: false });
    let api;
    try {
      await migrate(database, await discoverMigrations());
      await database.query(
        `INSERT INTO users(id, email, password_hash, display_name, role)
         VALUES($1, 'operational-admin@example.test', 'synthetic-unusable-hash', 'Admin operacional fictício', 'admin')`,
        [adminId],
      );

      const authService = {
        async session(token) {
          return token === "operational-admin-session"
            ? { id: adminId, role: "admin", displayName: "Admin operacional fictício" }
            : null;
        },
      };
      const operationalControlService = createOperationalControlService(createOperationalControlRepository(database));
      api = createApiServer({
        config: loadConfig({ NODE_ENV: "test", RATE_LIMIT_MAX: "1000" }),
        authService,
        operationalControlService,
      });
      await new Promise(resolve => api.listen(0, "127.0.0.1", resolve));
      const origin = `http://127.0.0.1:${api.address().port}`;
      const headers = { cookie: "fc_session=operational-admin-session", "content-type": "application/json" };

      const unauthenticated = await fetch(`${origin}/v1/admin/operational-control`);
      assert.equal(unauthenticated.status, 401);

      const pause = await fetch(`${origin}/v1/admin/operational-control`, {
        method: "PUT", headers,
        body: JSON.stringify({ domain: "marketplace", action: "pause", reason: "Pausa preventiva validada no teste PostgreSQL.", confirmed: true }),
      });
      assert.equal(pause.status, 200);
      assert.equal((await pause.json()).state.paused, true);

      const blocked = await fetch(`${origin}/v1/listings`, { method: "POST", headers, body: "{}" });
      assert.equal(blocked.status, 503);
      assert.equal((await blocked.json()).error.code, "operational_paused");

      const status = await fetch(`${origin}/v1/admin/operational-control`, { headers });
      assert.equal(status.status, 200);
      assert.equal(status.headers.get("cache-control"), "no-store");
      const marketplace = (await status.json()).items.find(item => item.domain === "marketplace");
      assert.equal(marketplace.paused, true);
      assert.equal(Number(marketplace.version), 2);

      const resume = await fetch(`${origin}/v1/admin/operational-control`, {
        method: "PUT", headers,
        body: JSON.stringify({ domain: "marketplace", action: "resume", reason: "Retomada operacional validada no teste PostgreSQL.", confirmed: true }),
      });
      assert.equal(resume.status, 200);
      assert.equal((await resume.json()).state.paused, false);

      const released = await fetch(`${origin}/v1/listings`, { method: "POST", headers, body: "{}" });
      assert.notEqual(released.status, 503);

      const persisted = await database.query("SELECT paused, version, changed_by FROM operational_controls WHERE domain = 'marketplace'");
      assert.equal(persisted.rows[0].paused, false);
      assert.equal(Number(persisted.rows[0].version), 3);
      assert.equal(persisted.rows[0].changed_by, adminId);
      const audit = await database.query(
        `SELECT action, metadata FROM audit_events
         WHERE entity_type = 'operational_control' AND entity_id = 'marketplace'
         ORDER BY occurred_at, id`,
      );
      assert.deepEqual(audit.rows.map(row => row.action), ["operations.paused", "operations.resumed"]);
      assert.deepEqual(audit.rows.map(row => row.metadata.newPaused), [true, false]);
    } finally {
      if (api?.listening) await new Promise(resolve => api.close(resolve));
      await database.close();
    }
  });
});
