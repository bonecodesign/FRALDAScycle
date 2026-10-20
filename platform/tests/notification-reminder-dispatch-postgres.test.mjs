import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabase } from '../database/client.js';
import { createNotificationRepository } from '../database/notification-repository.js';
import { discoverMigrations, migrate } from '../database/migrate.js';
import { withNativeTestPostgres, nativePostgresTools } from '../tools/native-postgres.mjs';
import { runNotificationBatch } from '../workers/notifications.js';

const native = await nativePostgresTools();
test('optional notification reminder is associated with its account and deferred in PostgreSQL without delivery', {
  skip: !native ? 'PostgreSQL nativo não disponível; sem homologação local declarada.' : false,
  timeout: 120000,
}, async () => {
  await withNativeTestPostgres(async databaseUrl => {
    const database = createDatabase({ databaseUrl, databaseSsl: false });
    try {
      await migrate(database, await discoverMigrations());
      const userId = '71000000-0000-4000-8000-000000000001';
      await database.query(`INSERT INTO users(id,email,phone,password_hash,display_name,email_verified_at,phone_verified_at)
        VALUES($1,'quiet-reminder@example.test','+5531999000000','synthetic-unusable-hash','Pessoa fictícia',now(),now())`, [userId]);
      await database.query(`INSERT INTO account_operational_preferences
        (user_id,email,sms,push,quiet_enabled,quiet_start,quiet_end,time_zone,version)
        VALUES($1,true,false,false,true,'21:00','08:00','UTC',1)`, [userId]);

      const repository = createNotificationRepository(database);
      const jobId = await repository.enqueue({
        kind: 'payment_reminder', recipient: 'quiet-reminder@example.test', userId,
        payload: { channel: 'email', message: 'Lembrete fictício' },
      });
      let providerCalls = 0;
      await runNotificationBatch(repository, {}, async () => { providerCalls++; return { ok: true }; },
        () => new Date('2026-10-18T23:00:00Z'));

      const result = (await database.query(`SELECT status,attempts,available_at,recipient_user_id,
          available_at > created_at + interval '14 minutes' AS deferred
        FROM notification_outbox WHERE id=$1`, [jobId])).rows[0];
      assert.equal(providerCalls, 0);
      assert.equal(result.status, 'pending');
      assert.equal(result.attempts, 0, 'deferral does not consume delivery retry attempts');
      assert.equal(result.recipient_user_id, userId);
      assert.equal(result.deferred, true, 'quiet-hours deferral persists its retry time');

      await database.query('UPDATE account_operational_preferences SET email=false,version=version+1 WHERE user_id=$1', [userId]);
      await database.query('UPDATE notification_outbox SET available_at=now() WHERE id=$1', [jobId]);
      await runNotificationBatch(repository, {}, async () => { providerCalls++; return { ok: true }; },
        () => new Date('2026-10-18T12:00:00Z'));
      const changedPreference = (await database.query('SELECT status,last_error FROM notification_outbox WHERE id=$1', [jobId])).rows[0];
      assert.equal(changedPreference.status, 'cancelled', 'current preference replaces the one present when queued');
      assert.match(changedPreference.last_error, /channel is not enabled/);
      assert.equal(providerCalls, 0);
      await database.query('UPDATE account_operational_preferences SET email=true,version=version+1 WHERE user_id=$1', [userId]);

      const disabledId = await repository.enqueue({
        kind: 'general_reminder', recipient: '+5531999000000', userId,
        payload: { channel: 'sms', message: 'Lembrete fictício sem consentimento de canal' },
      });
      await runNotificationBatch(repository, {}, async () => { providerCalls++; return { ok: true }; },
        () => new Date('2026-10-18T23:00:00Z'));
      const disabled = (await database.query('SELECT status,last_error FROM notification_outbox WHERE id=$1', [disabledId])).rows[0];
      assert.equal(disabled.status, 'cancelled');
      assert.match(disabled.last_error, /channel is not enabled/);
      assert.equal(providerCalls, 0);

      const wrongRecipientId = await repository.enqueue({
        kind: 'general_reminder', recipient: 'other-person@example.test', userId,
        payload: { channel: 'email', message: 'Destino de outra pessoa' },
      });
      const pushId = await repository.enqueue({
        kind: 'general_reminder', recipient: 'unbound-device-token', userId,
        payload: { channel: 'push', message: 'Dispositivo não vinculado' },
      });
      await runNotificationBatch(repository, {}, async () => { providerCalls++; return { ok: true }; },
        () => new Date('2026-10-18T12:00:00Z'));
      for (const id of [wrongRecipientId, pushId]) {
        const row = (await database.query('SELECT status,last_error FROM notification_outbox WHERE id=$1', [id])).rows[0];
        assert.equal(row.status, 'cancelled');
        assert.match(row.last_error, /recipient unavailable/);
      }
      assert.equal(providerCalls, 0);

      const validId = await repository.enqueue({
        kind: 'delivery_reminder', recipient: 'quiet-reminder@example.test', userId,
        payload: { channel: 'email', message: 'Destino verificado' },
      });
      await runNotificationBatch(repository,
        { notificationWebhookUrl: 'https://synthetic.example.test', notificationWebhookSecret: 'synthetic' },
        async () => { providerCalls++; return { ok: true }; }, () => new Date('2026-10-18T12:00:00Z'));
      assert.equal((await database.query('SELECT status FROM notification_outbox WHERE id=$1', [validId])).rows[0].status, 'delivered');
      assert.equal(providerCalls, 1);

      const suspendedId = await repository.enqueue({
        kind: 'delivery_reminder', recipient: 'quiet-reminder@example.test', userId,
        payload: { channel: 'email', message: 'Conta suspensa' },
      });
      await database.query('UPDATE users SET disabled_at=now() WHERE id=$1', [userId]);
      await runNotificationBatch(repository,
        { notificationWebhookUrl: 'https://synthetic.example.test', notificationWebhookSecret: 'synthetic' },
        async () => { providerCalls++; return { ok: true }; }, () => new Date('2026-10-18T12:00:00Z'));
      assert.equal((await database.query('SELECT status FROM notification_outbox WHERE id=$1', [suspendedId])).rows[0].status, 'cancelled');
      assert.equal(providerCalls, 1);
    } finally { await database.close(); }
  });
});
