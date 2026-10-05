import test from 'node:test';
import assert from 'node:assert/strict';
import { nativePostgresTools, withNativeTestPostgres } from '../tools/native-postgres.mjs';

const native = await nativePostgresTools();
test('native PostgreSQL beta validates immutable migrations, upgrade data and real preference concurrency', {
  skip: !native && !process.env.CI ? 'PostgreSQL nativo ausente neste ambiente; nenhuma homologação local alegada.' : false,
  timeout: 120000,
}, async () => {
  await withNativeTestPostgres(async databaseUrl => {
    const { createDatabase } = await import('../database/client.js');
    const { discoverMigrations, migrate } = await import('../database/migrate.js');
    const { createAccountConsentRepository } = await import('../database/account-consent-repository.js');
    const { createAccountConsentService } = await import('../apps/api/account-consent-service.js');
    const database = createDatabase({ databaseUrl, databaseSsl: false });
    try {
      const migrations = await discoverMigrations();
      await migrate(database, migrations.filter(migration => migration.name < '014_'));
      const user = '10000000-0000-4000-8000-000000000001';
      const other = '10000000-0000-4000-8000-000000000002';
      const listing = '20000000-0000-4000-8000-000000000001';
      const transaction = '30000000-0000-4000-8000-000000000001';
      await database.query(`INSERT INTO users(id,email,password_hash,display_name)
        VALUES($1,'synthetic-one@example.test','synthetic-unusable-hash','Pessoa fictícia um'),
              ($2,'synthetic-two@example.test','synthetic-unusable-hash','Pessoa fictícia dois')`, [user, other]);
      await database.query(`INSERT INTO listings(id,seller_id,title,description,brand,quantity,kind,price_cents,status)
        VALUES($1,$2,'Pacote fictício','Descrição exclusiva para validação interna','Pampers',10,'sale',10000,'reserved')`, [listing, user]);
      await database.query(`INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents)
        VALUES($1,$2,$3,$4,'reserved',10000)`, [transaction, listing, other, user]);
      await migrate(database, migrations);
      await Promise.all([migrate(database, migrations), migrate(database, migrations)]);
      const applied = await database.query('SELECT name,checksum FROM schema_migrations ORDER BY name');
      assert.deepEqual(applied.rows, migrations.map(({ name, checksum }) => ({ name, checksum })));
      assert.equal((await database.query('SELECT status FROM listings WHERE id=$1', [listing])).rows[0].status, 'unavailable');
      assert.equal((await database.query('SELECT status FROM transactions WHERE id=$1', [transaction])).rows[0].status, 'initiated');
      const service = createAccountConsentService(createAccountConsentRepository(database));
      const choices = email => ({ expectedVersion: 0, channels: { email, sms: false, push: false }, quietHours: { enabled: true, start: '22:00', end: '08:00', timeZone: 'UTC' } });
      const outcomes = await Promise.allSettled([service.saveOperationalPreferences(user, choices(true)), service.saveOperationalPreferences(user, choices(false))]);
      assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
      assert.equal(outcomes.find(outcome => outcome.status === 'rejected').reason.status, 409);
      const current = await service.operationalPreferences(user);
      assert.equal(current.version, 1);
      const retry = await service.saveOperationalPreferences(user, choices(current.channels.email));
      assert.equal(retry.reused, true);
      assert.equal(retry.preferences.version, 1);
      assert.equal((await service.operationalPreferences(other)).configured, false);
      assert.equal((await database.query('SELECT count(*)::integer AS count FROM operational_preference_events')).rows[0].count, 1);
      assert.equal((await database.query('SELECT count(*)::integer AS count FROM marketing_preference_events')).rows[0].count, 0);
      assert.equal((await database.query('SELECT count(*)::integer AS count FROM terms_acceptances')).rows[0].count, 0);
      await assert.rejects(service.acceptTerms(user, { accepted: true }), error => error.code === 'terms_not_active');
      console.log('BETA_POSTGRES: migrações reais, upgrade reservado, repetição, isolamento e concorrência de preferências executados.');
    } finally { await database.close(); }
  });
});
