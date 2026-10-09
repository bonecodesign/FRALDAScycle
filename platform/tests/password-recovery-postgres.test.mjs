import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { createDatabase } from '../database/client.js';
import { discoverMigrations, migrate } from '../database/migrate.js';
import { createAuthRepository } from '../database/auth-repository.js';

const databaseUrl = process.env.FC_LISTING_TEST_DATABASE_URL;
test('PostgreSQL serializes recovery issuance quotas and reopens expired windows', {
  skip: !databaseUrl ? 'Banco temporário de validação não configurado.' : false, timeout: 60000,
}, async () => {
  const url = new URL(databaseUrl);
  assert.equal(url.pathname, '/fc_listing_creation_test');
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  const database = createDatabase({ databaseUrl, databaseSsl: false });
  try {
    await migrate(database, await discoverMigrations());
    const repository = createAuthRepository(database), identityHash = randomBytes(32);
    const requests = await Promise.all(Array.from({ length: 20 }, () => repository.reservePasswordRecoveryRequest(identityHash)));
    assert.equal(requests.filter(Boolean).length, 1);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM login_attempts WHERE email_hash=$1', [identityHash])).rows[0].count, 1);
    for (let accepted = 1; accepted < 5; accepted++) {
      await database.query("UPDATE login_attempts SET attempted_at=now()-interval '61 seconds' WHERE email_hash=$1", [identityHash]);
      assert.equal(await repository.reservePasswordRecoveryRequest(identityHash), true);
    }
    await database.query("UPDATE login_attempts SET attempted_at=now()-interval '61 seconds' WHERE email_hash=$1", [identityHash]);
    assert.equal(await repository.reservePasswordRecoveryRequest(identityHash), false);
    const otherContact = randomBytes(32);
    assert.equal(await repository.reservePasswordRecoveryRequest(otherContact), true);
    await database.query("UPDATE login_attempts SET attempted_at=now()-interval '31 minutes' WHERE email_hash=$1", [identityHash]);
    assert.equal(await repository.reservePasswordRecoveryRequest(identityHash), true);
    console.log('Emissão: 20 pedidos simultâneos reservaram 1 envio; limite de 5 por 30 minutos, isolamento e reabertura verificados.');
  } finally { await database.close(); }
});

test('PostgreSQL recovery is atomic, single use and invalidates sessions and MFA', {
  skip: !databaseUrl ? 'Banco temporário de validação não configurado.' : false, timeout: 60000,
}, async () => {
  const url = new URL(databaseUrl);
  assert.equal(url.pathname, '/fc_listing_creation_test');
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  const database = createDatabase({ databaseUrl, databaseSsl: false });
  const owner = '10000000-0000-4000-8000-000000000004';
  try {
    await migrate(database, await discoverMigrations());
    await database.query("INSERT INTO users(id,email,password_hash,display_name) VALUES($1,'recovery-synthetic@example.test','old-synthetic','Conta fictícia')", [owner]);
    const repository = createAuthRepository(database);
    const expiresAt = new Date(Date.now() + 60_000);
    const tokenHash = randomBytes(32), mfaHash = randomBytes(32);
    const attemptHash = randomBytes(32);
    await repository.createSession({ userId: owner, tokenHash: randomBytes(32), expiresAt });
    await repository.createAuthToken({ userId: owner, kind: 'password_recovery', tokenHash, expiresAt });
    await repository.createAuthToken({ userId: owner, kind: 'admin_login_mfa', tokenHash: mfaHash, expiresAt });
    await database.query(`CREATE FUNCTION reject_recovery_password() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.password_hash='rollback-recovery-marker' THEN RAISE EXCEPTION 'synthetic recovery failure'; END IF; RETURN NEW; END $$`);
    await database.query('CREATE TRIGGER reject_recovery_password BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION reject_recovery_password()');
    await assert.rejects(repository.resetPasswordWithToken({ tokenHash, attemptHash, passwordHash: 'rollback-recovery-marker' }), /synthetic recovery failure/);
    assert.equal((await database.query('SELECT consumed_at FROM auth_tokens WHERE token_hash=$1', [tokenHash])).rows[0].consumed_at, null);
    assert.equal((await database.query('SELECT password_hash FROM users WHERE id=$1', [owner])).rows[0].password_hash, 'old-synthetic');
    assert.equal((await database.query('SELECT revoked_at FROM sessions WHERE user_id=$1', [owner])).rows[0].revoked_at, null);
    await database.query('DROP TRIGGER reject_recovery_password ON users');
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) => repository.resetPasswordWithToken({ tokenHash, attemptHash, passwordHash: `new-synthetic-${index}` })));
    assert.equal(results.filter(result => result === owner).length, 1);
    assert.equal(results.filter(result => result?.limited).length, 14);
    const winner = results.findIndex(result => result === owner);
    assert.equal((await database.query('SELECT password_hash FROM users WHERE id=$1', [owner])).rows[0].password_hash, `new-synthetic-${winner}`);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM sessions WHERE user_id=$1 AND revoked_at IS NULL', [owner])).rows[0].count, 0);
    assert.equal((await database.query("SELECT count(*)::int AS count FROM auth_tokens WHERE user_id=$1 AND kind IN ('password_recovery','admin_login_mfa') AND consumed_at IS NULL", [owner])).rows[0].count, 0);
    for (const scenario of ['expired', 'wrong-kind', 'disabled']) {
      const candidate = randomBytes(32);
      await repository.createAuthToken({ userId: owner, kind: scenario === 'wrong-kind' ? 'email_verification' : 'password_recovery', tokenHash: candidate, expiresAt: scenario === 'expired' ? new Date(Date.now() - 1000) : expiresAt });
      if (scenario === 'disabled') await database.query('UPDATE users SET disabled_at=now() WHERE id=$1', [owner]);
      assert.equal(await repository.resetPasswordWithToken({ tokenHash: candidate, attemptHash: randomBytes(32), passwordHash: 'must-not-apply' }), null);
      assert.equal((await database.query('SELECT password_hash FROM users WHERE id=$1', [owner])).rows[0].password_hash, `new-synthetic-${winner}`);
      assert.equal((await database.query('SELECT consumed_at FROM auth_tokens WHERE token_hash=$1', [candidate])).rows[0].consumed_at, null);
    }
    const wrongAttempt = randomBytes(32);
    const wrong = await Promise.all(Array.from({ length: 20 }, () => repository.resetPasswordWithToken({ tokenHash: randomBytes(32), attemptHash: wrongAttempt, passwordHash: 'must-not-apply' })));
    assert.equal(wrong.filter(result => result === null).length, 5);
    assert.equal(wrong.filter(result => result?.limited).length, 15);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM login_attempts WHERE email_hash=$1 AND succeeded=false', [wrongAttempt])).rows[0].count, 5);
    console.log('Recuperação: 20 tentativas inválidas registraram 5 falhas e bloquearam as 15 restantes.');
    console.log('Recuperação: rollback preservou senha, código e sessão; 20 solicitações alteraram a senha uma vez; sessões e MFA anteriores invalidados.');
  } finally { await database.close(); }
});
