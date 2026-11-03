import assert from "node:assert/strict";
import test from "node:test";
import { createChildProfileLifecycleRepository } from "../database/child-profile-lifecycle-repository.js";
import { createChildProfileRepository } from "../database/child-profile-repository.js";
import { createNotificationRepository } from "../database/notification-repository.js";
import { createDatabase } from "../database/client.js";
import { discoverMigrations, migrate } from "../database/migrate.js";
import { nativePostgresTools, withNativeTestPostgres } from "../tools/native-postgres.mjs";
import { runNotificationBatch } from "../workers/notifications.js";

const native = await nativePostgresTools();

test("age limit warning and closure are atomic, private and idempotent in PostgreSQL", {
  skip: !native && !process.env.CI ? "PostgreSQL nativo ausente neste ambiente." : false,
  timeout: 60_000,
}, async () => {
  await withNativeTestPostgres(async databaseUrl => {
    const database = createDatabase({ databaseUrl, databaseSsl: false });
    try {
      await migrate(database, await discoverMigrations());
      const account = "11111111-1111-4111-8111-111111111111";
      await database.query(
        `INSERT INTO users(id,email,email_verified_at,password_hash,display_name,role,adult_declaration_version,adult_declared_at)
         VALUES($1,'family-lifecycle@example.test',now(),'fixture','Responsável fictício','customer','FC-AGE-1',now())`,
        [account],
      );
      await database.query(
        `INSERT INTO child_profiles(account_id,birth_date,emoji,consent_version,consented_at,personalization_enabled)
         VALUES($1,'2013-11-22','🍼','FC-CHILD-PROFILE-1',now(),true),
               ($1,'2013-10-23','🧸','FC-CHILD-PROFILE-1',now(),true),
               ($1,'2020-01-01','⭐','FC-CHILD-PROFILE-1',now(),true)`,
        [account],
      );
      const repository = createChildProfileLifecycleRepository(database);
      assert.deepEqual(await repository.process(new Date("2026-10-23T12:00:00Z")), { warnings: 1, closed: 1 });
      assert.deepEqual(await repository.process(new Date("2026-10-23T18:00:00Z")), { warnings: 0, closed: 0 });

      const ageOnlyAccount = "55555555-5555-4555-8555-555555555555";
      await database.query(
        `INSERT INTO users(id,email,password_hash,display_name,role,adult_declaration_version,adult_declared_at)
         VALUES($1,'family-age-only@example.test','fixture','Responsável etário','customer','FC-AGE-1',now())`,
        [ageOnlyAccount],
      );
      await database.query(
        `INSERT INTO child_profiles(account_id,birth_date,emoji,consent_version,consented_at,personalization_enabled)
         VALUES($1,'2013-10-23','🌙','FC-CHILD-PROFILE-1',now(),true)`,
        [ageOnlyAccount],
      );
      assert.deepEqual(await repository.process(new Date("2026-10-23T19:00:00Z")), { warnings: 0, closed: 1 });
      assert.equal(await createChildProfileRepository(database).operationProfileState(ageOnlyAccount), "age_limit_ended");

      const profiles = (await database.query(`SELECT birth_date,deleted_at,lifecycle_ended_reason FROM child_profiles ORDER BY emoji`)).rows;
      const ended = profiles.find(row => row.lifecycle_ended_reason === "age_limit");
      assert.equal(ended.birth_date, null);
      assert.ok(ended.deleted_at);
      assert.equal((await database.query(`SELECT count(*)::int AS count FROM account_notices WHERE user_id=$1 AND kind='child_profile_age_limit'`, [account])).rows[0].count, 2);
      const jobs = (await database.query(`SELECT payload::text AS payload FROM notification_outbox WHERE recipient_user_id=$1 AND kind='account_lifecycle_notice'`, [account])).rows;
      assert.equal(jobs.length, 2);
      assert.ok(jobs.every(row => !/2013|birth/i.test(row.payload)));
      const deliveries = [];
      assert.equal(await runNotificationBatch(
        createNotificationRepository(database),
        { notificationWebhookUrl: "https://synthetic.example.test", notificationWebhookSecret: "synthetic" },
        async (_url, options) => { deliveries.push(JSON.parse(options.body)); return { ok: true, status: 200 }; },
      ), 2);
      assert.equal(deliveries.length, 2);
      assert.ok(deliveries.every(delivery => delivery.kind === "account_lifecycle_notice"));
      const audit = (await database.query(`SELECT metadata::text AS metadata FROM audit_events WHERE actor_user_id=$1 AND action='child_profile.age_limit_closed'`, [account])).rows;
      assert.equal(audit.length, 1);
      assert.doesNotMatch(audit[0].metadata, /2013|birth/i);
    } finally { await database.close(); }
  });
});
