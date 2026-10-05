import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nativePostgresTools, withNativeTestPostgres, freeLocalPort } from '../tools/native-postgres.mjs';

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
      await database.query('CREATE DATABASE beta_clean');
      const cleanUrl = new URL(databaseUrl); cleanUrl.pathname = '/beta_clean';
      const cleanDatabase = createDatabase({ databaseUrl: cleanUrl.toString(), databaseSsl: false });
      try {
        await migrate(cleanDatabase, migrations);
        assert.equal((await cleanDatabase.query('SELECT count(*)::integer AS count FROM schema_migrations')).rows[0].count, migrations.length);
      } finally { await cleanDatabase.close(); }
      console.log('BETA_POSTGRES_CLEAN: migrações aplicadas desde banco vazio.');
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
      assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1,
        outcomes.filter(outcome => outcome.status === 'rejected').map(outcome => `${outcome.reason.code}: ${outcome.reason.message}`).join('; '));
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
      await assert.rejects(database.transaction(client => client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
        VALUES($1,'beta.old_audit_reproducer','user',$1,'{}'::jsonb)`, [user])), error => error.code === '42P08');
      await service.saveMarketingPreferences(user, { email: true, sms: false, push: false });
      assert.equal((await service.marketingPreferences(user)).email, true);
      await service.saveMarketingPreferences(user, { email: false, sms: false, push: false });
      assert.equal((await service.marketingPreferences(user)).email, false);
      assert.equal((await database.query('SELECT count(*)::integer AS count FROM marketing_preference_events')).rows[0].count, 2);
      await assert.rejects(service.acceptTerms(user, { accepted: true }), error => error.code === 'terms_not_active');
      console.log('BETA_POSTGRES: migrações reais, upgrade reservado, repetição, isolamento e concorrência de preferências executados.');
      const { createAuthService } = await import('../apps/api/auth-service.js');
      const { createAuthRepository } = await import('../database/auth-repository.js');
      const { createApiServer } = await import('../apps/api/server.js');
      const { loadConfig } = await import('../apps/api/config.js');
      const authService = createAuthService(createAuthRepository(database));
      const fixture = { email: 'browser-fixture@example.test', displayName: 'Pessoa fictícia navegador', password: 'synthetic-only-password-v1' };
      await authService.register(fixture);
      const session = await authService.login(fixture);
      const currentSession = await authService.session(session.token);
      const extraSession = await authService.login(fixture);
      const { createAdminRepository } = await import('../database/admin-repository.js');
      assert.equal(await createAdminRepository(database).revokeOtherSessions({ actorUserId: currentSession.id, currentSessionId: currentSession.sessionId }), 1);
      assert.equal(await authService.session(extraSession.token), null);
      assert.ok(await authService.session(session.token));
      const surfacePort = await freeLocalPort();
      const surfaceOrigin = `http://127.0.0.1:${surfacePort}`;
      const api = createApiServer({ config: loadConfig({ NODE_ENV: 'test', CORS_ORIGINS: surfaceOrigin }), authService, accountConsentService: service });
      await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
      const surface = spawn(process.execPath, [fileURLToPath(new URL('../tools/dev-server.mjs', import.meta.url)), 'app', String(surfacePort)], { env: { ...process.env, NODE_ENV: 'test', SURFACE_HOST: '127.0.0.1', SURFACE_API_ORIGIN: `http://127.0.0.1:${api.address().port}` }, stdio: ['ignore', 'ignore', 'ignore'] });
      try {
        const deadline = Date.now() + 12000;
        let ready = false;
        while (Date.now() < deadline) {
          try { if ((await fetch(surfaceOrigin + '/app/notification-settings')).ok) { ready = true; break; } } catch { /* Aguardando somente servidor local. */ }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert.equal(ready, true, 'Surface server did not start');
        const args = [...(typeof WebSocket === 'undefined' ? ['--experimental-websocket'] : []), fileURLToPath(new URL('../tools/beta-browser-check.mjs', import.meta.url))];
        const browser = spawn(process.execPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
        let output = ''; let errors = '';
        browser.stdout.on('data', chunk => { output += chunk; });
        browser.stderr.on('data', chunk => { errors += chunk; });
        browser.stdin.end(JSON.stringify({ surfaceOrigin, apiOrigin: `http://127.0.0.1:${api.address().port}`, sessionToken: session.token }));
        const code = await new Promise((resolve, reject) => { browser.once('error', reject); browser.once('exit', resolve); });
        assert.equal(code, 0, errors);
        const result = JSON.parse(output);
        assert.deepEqual(result.layouts.map(layout => layout.viewport), [320, 375, 768, 1280]);
        console.log('BETA_BROWSER: ' + JSON.stringify(result));
      } finally {
        if (surface.exitCode === null) { const stopped = new Promise(resolve => surface.once('exit', resolve)); surface.kill('SIGKILL'); await stopped; }
        await new Promise(resolve => api.close(resolve));
      }
    } finally { await database.close(); }
  });
});
