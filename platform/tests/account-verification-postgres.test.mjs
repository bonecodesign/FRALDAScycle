import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { createDatabase } from '../database/client.js';
import { discoverMigrations, migrate } from '../database/migrate.js';
import { createAuthRepository } from '../database/auth-repository.js';

const databaseUrl = process.env.FC_LISTING_TEST_DATABASE_URL;
test('PostgreSQL verification is atomic, single use and enforces concurrent attempt and issuance limits', {
  skip: !databaseUrl ? 'Banco temporário de validação não configurado.' : false, timeout: 60000,
}, async () => {
  const url = new URL(databaseUrl);
  assert.equal(url.pathname, '/fc_listing_creation_test'); assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
  const database = createDatabase({ databaseUrl, databaseSsl: false });
  const owner = '10000000-0000-4000-8000-000000000010';
  try {
    await migrate(database, await discoverMigrations());
    await database.query("INSERT INTO users(id,email,password_hash,display_name) VALUES($1,'verification-test@example.test','synthetic-unusable','Conta fictícia')", [owner]);
    const auth = createAuthRepository(database), tokenHash = randomBytes(32), attemptHash = randomBytes(32);
    const expiresAt = new Date(Date.now()+60_000);
    await auth.createAuthToken({ userId: owner, kind: 'email_verification', tokenHash, expiresAt });
    await database.query(`CREATE FUNCTION reject_verification_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='10000000-0000-4000-8000-000000000010' AND NEW.email_verified_at IS NOT NULL AND OLD.email_verified_at IS NULL THEN RAISE EXCEPTION 'synthetic verification update failure'; END IF; RETURN NEW; END $$`);
    await database.query('CREATE TRIGGER reject_verification_update BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION reject_verification_update()');
    await assert.rejects(auth.confirmVerificationToken({ tokenHash, attemptHash }), /synthetic verification update failure/);
    assert.equal((await database.query('SELECT consumed_at FROM auth_tokens WHERE token_hash=$1',[tokenHash])).rows[0].consumed_at, null);
    assert.equal((await database.query('SELECT email_verified_at FROM users WHERE id=$1',[owner])).rows[0].email_verified_at, null);
    await database.query('DROP TRIGGER reject_verification_update ON users');
    const results = await Promise.all(Array.from({length:20},()=>auth.confirmVerificationToken({tokenHash,attemptHash})));
    assert.equal(results.filter(result=>result.user).length,1);
    assert.equal(results.filter(result=>result.limited).length,14);
    const wrongHash=randomBytes(32);
    const wrong=await Promise.all(Array.from({length:20},()=>auth.confirmVerificationToken({tokenHash:randomBytes(32),attemptHash:wrongHash})));
    assert.equal(wrong.filter(result=>result.limited).length,15);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM login_attempts WHERE email_hash=$1 AND succeeded=false',[wrongHash])).rows[0].count,5);
    for(const scenario of ['expired','wrong-kind','disabled']){
      const hash=randomBytes(32);
      await auth.createAuthToken({userId:owner,kind:scenario==='wrong-kind'?'password_recovery':'email_verification',tokenHash:hash,expiresAt:scenario==='expired'?new Date(Date.now()-1000):expiresAt});
      if(scenario==='disabled')await database.query('UPDATE users SET disabled_at=now() WHERE id=$1',[owner]);
      assert.equal((await auth.confirmVerificationToken({tokenHash:hash,attemptHash:randomBytes(32)})).user,null);
      assert.equal((await database.query('SELECT consumed_at FROM auth_tokens WHERE token_hash=$1',[hash])).rows[0].consumed_at,null);
    }
    const identityHash=randomBytes(32);
    assert.equal((await Promise.all(Array.from({length:20},()=>auth.reserveVerificationRequest(identityHash)))).filter(Boolean).length,1);
    for(let count=1;count<5;count++){
      await database.query("UPDATE login_attempts SET attempted_at=now()-interval '61 seconds' WHERE email_hash=$1",[identityHash]);
      assert.equal(await auth.reserveVerificationRequest(identityHash),true);
    }
    await database.query("UPDATE login_attempts SET attempted_at=now()-interval '61 seconds' WHERE email_hash=$1",[identityHash]);
    assert.equal(await auth.reserveVerificationRequest(identityHash),false);
    await database.query("UPDATE login_attempts SET attempted_at=now()-interval '31 minutes' WHERE email_hash=$1",[identityHash]);
    assert.equal(await auth.reserveVerificationRequest(identityHash),true);
    const registrationHash=randomBytes(32);
    await auth.createUserWithVerification({email:'verification-quota-registration@example.test',displayName:'Pessoa fictícia',passwordHash:'unusable',adultDeclarationVersion:'FC-AGE-1',verification:{token:'123456',tokenHash:randomBytes(32),expiresAt,identityHash:registrationHash}});
    assert.equal(await auth.reserveVerificationRequest(registrationHash),false);
    const deniedHash=randomBytes(32);
    assert.equal(await auth.reserveVerificationRequest(deniedHash),true);
    await assert.rejects(auth.createUserWithVerification({email:'verification-quota-denied@example.test',displayName:'Pessoa fictícia',passwordHash:'unusable',adultDeclarationVersion:'FC-AGE-1',verification:{token:'123456',tokenHash:randomBytes(32),expiresAt,identityHash:deniedHash}}), error=>error.code==='verification_request_limited');
    assert.equal((await database.query("SELECT count(*)::int AS count FROM users WHERE email='verification-quota-denied@example.test'")).rows[0].count,0);
    // Do not leave a pending notification for the queue tests running in another file.
    await database.query("UPDATE notification_outbox SET status='cancelled',payload=payload-'token' WHERE recipient='verification-quota-registration@example.test'");
    console.log('Verificação: rollback preservou código; 20 confirmações tiveram 1 sucesso; 20 erros limitaram a 5 falhas; cadastro e reenvio compartilham cota.');
  }finally{await database.close()}
});
