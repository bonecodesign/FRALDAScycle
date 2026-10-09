import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { createDatabase } from '../database/client.js';
import { discoverMigrations, migrate } from '../database/migrate.js';
import { createAuthRepository } from '../database/auth-repository.js';
import { createNotificationRepository } from '../database/notification-repository.js';
import { runNotificationBatch } from '../workers/notifications.js';

const databaseUrl = process.env.FC_LISTING_TEST_DATABASE_URL;
test('PostgreSQL fences stale notification workers and scrubs terminal authentication codes', {
  skip: !databaseUrl ? 'Banco temporário de validação não configurado.' : false, timeout: 60000,
}, async () => {
  const url = new URL(databaseUrl);
  assert.equal(url.pathname, '/fc_listing_creation_test'); assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
  const database = createDatabase({ databaseUrl, databaseSsl: false });
  const owner = '10000000-0000-4000-8000-000000000011', recipient = 'lease-test@example.test';
  try {
    await migrate(database, await discoverMigrations());
    await database.query('INSERT INTO users(id,email,password_hash,display_name) VALUES($1,$2,$3,$4)', [owner,recipient,'unusable','Pessoa fictícia']);
    const auth = createAuthRepository(database), queue = createNotificationRepository(database);
    const issue = async () => {
      const hash = randomBytes(32);
      await auth.createAuthToken({userId:owner,kind:'email_verification',tokenHash:hash,expiresAt:new Date(Date.now()+20*60_000)});
      return hash;
    };
    const hash = await issue();
    const enqueue = authTokenHash => queue.enqueue({kind:'email_verification',recipient,payload:{token:'123456',channel:'email'},authTokenHash});
    const id = await enqueue(hash);
    const claims = (await Promise.all(Array.from({length:20},()=>queue.claimBatch(1)))).flat();
    assert.equal(claims.length,1); assert.equal(claims[0].id,id);
    const stale = claims[0].claim_token;
    assert.equal(await queue.canDeliver(id),false);
    await database.query("UPDATE notification_outbox SET locked_at=now()-interval '11 minutes' WHERE id=$1",[id]);
    assert.equal(await queue.canDeliver(id,stale),false);
    await queue.cancelled(id,stale); await queue.delivered(id,stale); await queue.failed(id,'expired lease',15,stale);
    assert.equal((await database.query('SELECT status FROM notification_outbox WHERE id=$1',[id])).rows[0].status,'processing');
    assert.equal(await queue.recoverStaleLocks(),1);
    const [current] = await queue.claimBatch(1);
    assert.notEqual(current.claim_token,stale);
    await queue.delivered(id,stale); await queue.failed(id,'stale failure',15,stale); await queue.cancelled(id,stale);
    assert.equal((await database.query('SELECT status FROM notification_outbox WHERE id=$1',[id])).rows[0].status,'processing');
    assert.equal(await queue.canDeliver(id,stale),false); assert.equal(await queue.canDeliver(id,current.claim_token),true);
    await queue.delivered(id,current.claim_token);
    assert.equal((await database.query('SELECT payload FROM notification_outbox WHERE id=$1',[id])).rows[0].payload.token,undefined);
    const syntheticJobs = await Promise.all(Array.from({length:20},()=>enqueue(hash)));
    const sent = new Map();
    await Promise.all(Array.from({length:4},()=>runNotificationBatch(queue,{notificationWebhookUrl:'https://synthetic.example.test',notificationWebhookSecret:'synthetic'},async (_url,options)=>{
      const job=JSON.parse(options.body); assert.equal(options.headers['idempotency-key'],job.id);
      sent.set(job.id,(sent.get(job.id)??0)+1); return {ok:true};
    })));
    assert.equal(sent.size,20); for(const job of syntheticJobs)assert.equal(sent.get(job),1);
    assert.equal((await database.query("SELECT count(*)::int AS count FROM notification_outbox WHERE recipient=$1 AND status='delivered' AND payload ? 'token'",[recipient])).rows[0].count,0);
    const exhausted = await enqueue(hash);
    await database.query('UPDATE notification_outbox SET attempts=7 WHERE id=$1',[exhausted]);
    const [lastAttempt] = await queue.claimBatch();
    await queue.failed(exhausted,'synthetic final failure',15,lastAttempt.claim_token);
    const terminal=(await database.query('SELECT status,payload FROM notification_outbox WHERE id=$1',[exhausted])).rows[0];
    assert.equal(terminal.status,'cancelled'); assert.equal(terminal.payload.token,undefined);
    const used=await enqueue(hash); const [usedClaim]=await queue.claimBatch();
    await database.query('UPDATE auth_tokens SET consumed_at=now() WHERE token_hash=$1',[hash]);
    await queue.claimBatch();
    assert.equal((await database.query('SELECT payload FROM notification_outbox WHERE id=$1',[used])).rows[0].payload.token,undefined);
    assert.equal(await queue.canDeliver(used,usedClaim.claim_token),false);
    await queue.cancelled(used,usedClaim.claim_token);
    const expiredHash=await issue(),expired=await enqueue(expiredHash);
    await database.query("UPDATE auth_tokens SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[expiredHash]);
    await queue.claimBatch();
    assert.equal((await database.query('SELECT payload FROM notification_outbox WHERE id=$1',[expired])).rows[0].payload.token,undefined);
    const legacy=await queue.enqueue({kind:'email_verification',recipient,payload:{token:'legacy'}});
    await database.query("UPDATE notification_outbox SET created_at=now()-interval '31 minutes' WHERE id=$1",[legacy]);
    await queue.claimBatch();
    const removed=(await database.query('SELECT status,payload FROM notification_outbox WHERE id=$1',[legacy])).rows[0];
    assert.equal(removed.status,'cancelled'); assert.equal(removed.payload.token,undefined);
    console.log('Fila: 20 reservas tiveram um dono; resposta antiga não alterou a nova reserva; quatro trabalhadores enviaram 20 mensagens distintas uma vez; códigos terminais removidos.');
  }finally{await database.close()}
});

test('PostgreSQL registration commits account, verification and notification together', {
  skip: !databaseUrl ? 'Banco temporário de validação não configurado.' : false, timeout: 60000,
}, async () => {
  const url = new URL(databaseUrl);
  assert.equal(url.pathname, '/fc_listing_creation_test');
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  const database = createDatabase({ databaseUrl, databaseSsl: false });
  try {
    await migrate(database, await discoverMigrations());
    const auth = createAuthRepository(database), queue = createNotificationRepository(database);
    const email = 'atomic-registration@example.test';
    const input = { email, displayName: 'Pessoa fictícia', passwordHash: 'unusable-synthetic', adultDeclarationVersion: 'FC-AGE-1',
      verification: { token: '123456', tokenHash: randomBytes(32), expiresAt: new Date(Date.now() + 60_000) } };
    await database.query(`CREATE FUNCTION reject_registration_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.recipient='atomic-registration@example.test' THEN RAISE EXCEPTION 'synthetic registration queue failure'; END IF; RETURN NEW; END $$`);
    await database.query('CREATE TRIGGER reject_registration_notification BEFORE INSERT ON notification_outbox FOR EACH ROW EXECUTE FUNCTION reject_registration_notification()');
    await assert.rejects(auth.createUserWithVerification(input), /synthetic registration queue failure/);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM users WHERE email=$1', [email])).rows[0].count, 0);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM auth_tokens WHERE token_hash=$1', [input.verification.tokenHash])).rows[0].count, 0);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM notification_outbox WHERE recipient=$1', [email])).rows[0].count, 0);
    await database.query('DROP TRIGGER reject_registration_notification ON notification_outbox');
    const outcomes = await Promise.allSettled(Array.from({ length: 20 }, () => auth.createUserWithVerification(input)));
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    for (const failure of outcomes.filter(result => result.status === 'rejected')) {
      assert.equal(failure.reason.code, '23505'); assert.equal(failure.reason.constraint, 'users_email_unique');
    }
    const user = outcomes.find(result => result.status === 'fulfilled').value;
    assert.equal(user.role, 'customer'); assert.equal(user.adult_declaration_version, 'FC-AGE-1');
    assert.equal((await database.query('SELECT count(*)::int AS count FROM auth_tokens WHERE user_id=$1', [user.id])).rows[0].count, 1);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM notification_outbox WHERE recipient=$1', [email])).rows[0].count, 1);
    await assert.rejects(auth.createUserWithVerification({ ...input, email: 'registration-collision@example.test' }), error => error.code === '23505' && error.constraint === 'auth_tokens_token_hash_key');
    assert.equal((await database.query("SELECT count(*)::int AS count FROM users WHERE email='registration-collision@example.test'")).rows[0].count, 0);
    const phone = '31999000009';
    const phoneUser = await auth.createUserWithVerification({ ...input, email: null, phone, verification: { ...input.verification, tokenHash: randomBytes(32) } });
    const sms = (await database.query('SELECT n.payload FROM notification_outbox n JOIN auth_tokens t ON t.id=n.auth_token_id WHERE t.user_id=$1', [phoneUser.id])).rows[0];
    assert.deepEqual(sms.payload, { token: '123456', channel: 'sms' });
    await assert.rejects(auth.createUserWithVerification({ ...input, email: 'registration-phone-conflict@example.test', phone, verification: { ...input.verification, tokenHash: randomBytes(32) } }), error => error.constraint === 'users_phone_unique');
    for (const job of await queue.claimBatch()) await queue.cancelled(job.id, job.claim_token);
    console.log('Cadastro: falha na fila não deixou conta nem código; vinte pedidos criaram uma conta, um código e uma mensagem; SMS e conflitos verificados.');
  } finally { await database.close(); }
});

test('PostgreSQL verification and MFA issuance roll back with the queue and use the current contact', {
  skip: !databaseUrl ? 'Banco temporário de validação não configurado.' : false, timeout: 60000,
}, async () => {
  const url = new URL(databaseUrl);
  assert.equal(url.pathname, '/fc_listing_creation_test');
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  const database = createDatabase({ databaseUrl, databaseSsl: false });
  const owner = '10000000-0000-4000-8000-000000000008';
  try {
    await migrate(database, await discoverMigrations());
    await database.query("INSERT INTO users(id,email,password_hash,display_name,role) VALUES($1,'atomic-verification@example.test','unusable-synthetic','Conta fictícia','admin')", [owner]);
    const auth = createAuthRepository(database), queue = createNotificationRepository(database);
    const expiresAt = new Date(Date.now() + 60_000);
    for (const kind of ['email_verification', 'admin_login_mfa']) {
      if (kind === 'admin_login_mfa') await database.query("UPDATE users SET email=NULL,phone='31999000008' WHERE id=$1", [owner]);
      const issue = (tokenHash, token = '123456') => auth.createAuthToken({ userId: owner, kind, tokenHash, expiresAt, notification: { token } });
      const oldHash = randomBytes(32), candidateHash = randomBytes(32);
      const oldId = await issue(oldHash);
      await database.query(`CREATE OR REPLACE FUNCTION reject_atomic_verification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.payload->>'token'='654321' THEN RAISE EXCEPTION 'synthetic verification queue failure'; END IF; RETURN NEW; END $$`);
      await database.query('CREATE TRIGGER reject_atomic_verification BEFORE INSERT ON notification_outbox FOR EACH ROW EXECUTE FUNCTION reject_atomic_verification()');
      await assert.rejects(issue(candidateHash, '654321'), /synthetic verification queue failure/);
      assert.equal((await database.query('SELECT consumed_at FROM auth_tokens WHERE id=$1', [oldId])).rows[0].consumed_at, null);
      assert.equal((await database.query('SELECT count(*)::int AS count FROM auth_tokens WHERE token_hash=$1', [candidateHash])).rows[0].count, 0);
      assert.equal((await database.query('SELECT count(*)::int AS count FROM notification_outbox WHERE auth_token_id=$1', [oldId])).rows[0].count, 1);
      await database.query('DROP TRIGGER reject_atomic_verification ON notification_outbox');
      const createdId = await issue(candidateHash);
      const notification = (await database.query('SELECT recipient,payload FROM notification_outbox WHERE auth_token_id=$1', [createdId])).rows[0];
      assert.equal(notification.recipient, kind === 'admin_login_mfa' ? '31999000008' : 'atomic-verification@example.test');
      assert.equal(notification.payload.channel, kind === 'admin_login_mfa' ? 'sms' : 'email');
      await Promise.all(Array.from({ length: 8 }, () => issue(randomBytes(32))));
      assert.equal((await database.query('SELECT count(*)::int AS count FROM auth_tokens WHERE user_id=$1 AND kind=$2 AND consumed_at IS NULL', [owner, kind])).rows[0].count, 1);
      const jobs = await queue.claimBatch(); assert.equal(jobs.length, 1);
      await queue.cancelled(jobs[0].id, jobs[0].claim_token);
      if (kind === 'admin_login_mfa') {
        await database.query("UPDATE users SET role='customer' WHERE id=$1", [owner]);
        assert.equal(await issue(randomBytes(32)), null);
      }
      console.log(`${kind}: rollback preservou código anterior; mensagem única vinculada; oito emissões deixaram um código ativo.`);
    }
  } finally { await database.close(); }
});

test('PostgreSQL commits recovery codes and notifications together and preserves old codes on failure', {
  skip: !databaseUrl ? 'Banco temporário de validação não configurado.' : false, timeout: 60000,
}, async () => {
  const url = new URL(databaseUrl);
  assert.equal(url.pathname, '/fc_listing_creation_test');
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  const database = createDatabase({ databaseUrl, databaseSsl: false });
  const owner = '10000000-0000-4000-8000-000000000006';
  const recipient = 'atomic-notification-synthetic@example.test';
  try {
    await migrate(database, await discoverMigrations());
    await database.query('INSERT INTO users(id,email,password_hash,display_name) VALUES($1,$2,$3,$4)', [owner, recipient, 'unusable-synthetic', 'Conta fictícia']);
    const auth = createAuthRepository(database), queue = createNotificationRepository(database);
    const expiresAt = new Date(Date.now() + 60_000), oldHash = randomBytes(32), newHash = randomBytes(32);
    const issue = tokenHash => auth.createAuthToken({ userId: owner, kind: 'password_recovery', tokenHash, expiresAt, notification: { token: '123456' } });
    const oldId = await issue(oldHash);
    await database.query(`CREATE FUNCTION reject_atomic_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.recipient='atomic-notification-synthetic@example.test' THEN RAISE EXCEPTION 'synthetic notification failure'; END IF; RETURN NEW; END $$`);
    await database.query('CREATE TRIGGER reject_atomic_notification BEFORE INSERT ON notification_outbox FOR EACH ROW EXECUTE FUNCTION reject_atomic_notification()');
    await assert.rejects(issue(newHash), /synthetic notification failure/);
    assert.equal((await database.query('SELECT consumed_at FROM auth_tokens WHERE id=$1', [oldId])).rows[0].consumed_at, null);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM auth_tokens WHERE token_hash=$1', [newHash])).rows[0].count, 0);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM notification_outbox WHERE recipient=$1', [recipient])).rows[0].count, 1);
    await database.query('DROP TRIGGER reject_atomic_notification ON notification_outbox');
    const newId = await issue(newHash);
    const queued = (await database.query('SELECT kind,payload,auth_token_id FROM notification_outbox WHERE auth_token_id=$1', [newId])).rows;
    assert.equal(queued.length, 1); assert.equal(queued[0].kind, 'password_recovery');
    assert.deepEqual(queued[0].payload, { token: '123456', channel: 'email' });
    assert.notEqual((await database.query('SELECT consumed_at FROM auth_tokens WHERE id=$1', [oldId])).rows[0].consumed_at, null);
    await Promise.all(Array.from({ length: 20 }, () => issue(randomBytes(32))));
    const active = (await database.query("SELECT id FROM auth_tokens WHERE user_id=$1 AND kind='password_recovery' AND consumed_at IS NULL", [owner])).rows;
    assert.equal(active.length, 1);
    const jobs = await queue.claimBatch();
    assert.equal(jobs.length, 1);
    assert.equal((await database.query('SELECT auth_token_id FROM notification_outbox WHERE id=$1', [jobs[0].id])).rows[0].auth_token_id, active[0].id);
    await queue.cancelled(jobs[0].id, jobs[0].claim_token);
    await database.query('UPDATE users SET disabled_at=now() WHERE id=$1', [owner]);
    assert.equal(await issue(randomBytes(32)), null);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM notification_outbox WHERE recipient=$1', [recipient])).rows[0].count, 22);
    console.log('Emissão atômica: falha na fila preservou o código anterior; repetição criou código e mensagem vinculados; 20 emissões deixaram 1 envio elegível.');
  } finally { await database.close(); }
});

test('PostgreSQL cancels stale authentication notifications and rechecks claimed codes', {
  skip: !databaseUrl ? 'Banco temporário de validação não configurado.' : false, timeout: 60000,
}, async () => {
  const url = new URL(databaseUrl);
  assert.equal(url.pathname, '/fc_listing_creation_test');
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  const database = createDatabase({ databaseUrl, databaseSsl: false });
  const owner = '10000000-0000-4000-8000-000000000005';
  try {
    await migrate(database, await discoverMigrations());
    await database.query("INSERT INTO users(id,email,password_hash,display_name) VALUES($1,'notification-synthetic@example.test','unusable-synthetic','Conta fictícia')", [owner]);
    const auth = createAuthRepository(database), queue = createNotificationRepository(database);
    const kind = 'password_recovery', recipient = 'notification-synthetic@example.test';
    const expiresAt = new Date(Date.now() + 60_000);
    const issue = async () => {
      const tokenHash = randomBytes(32);
      await auth.createAuthToken({ userId: owner, kind, tokenHash, expiresAt });
      const id = await queue.enqueue({ kind, recipient, payload: { token: '123456', channel: 'email' }, authTokenHash: tokenHash });
      assert.ok(id); return { id, tokenHash };
    };
    const old = await issue(), current = await issue();
    assert.equal(await queue.enqueue({ kind, recipient, payload: { token: '123456' }, authTokenHash: old.tokenHash }), null);
    const claimed = await queue.claimBatch();
    assert.deepEqual(claimed.map(job => job.id), [current.id]);
    const lease = claimed[0].claim_token;
    const previous = (await database.query('SELECT status,payload FROM notification_outbox WHERE id=$1', [old.id])).rows[0];
    assert.equal(previous.status, 'cancelled'); assert.equal(previous.payload.token, undefined);
    assert.equal(await queue.canDeliver(current.id, lease), true);
    const next = await issue();
    assert.equal(await queue.canDeliver(current.id, lease), false);
    await queue.cancelled(current.id, lease);
    await queue.failed(current.id, 'late failure', 15, lease);
    await queue.delivered(current.id, lease);
    assert.equal((await database.query('SELECT status FROM notification_outbox WHERE id=$1', [current.id])).rows[0].status, 'cancelled');
    await database.query("UPDATE auth_tokens SET expires_at=now()-interval '1 second' WHERE token_hash=$1", [next.tokenHash]);
    assert.equal((await queue.claimBatch()).length, 0);
    assert.equal((await database.query('SELECT status FROM notification_outbox WHERE id=$1', [next.id])).rows[0].status, 'cancelled');
    const suspended = await issue();
    await database.query('UPDATE users SET disabled_at=now() WHERE id=$1', [owner]);
    assert.equal((await queue.claimBatch()).length, 0);
    assert.equal((await database.query('SELECT status FROM notification_outbox WHERE id=$1', [suspended.id])).rows[0].status, 'cancelled');
    const legacy = await queue.enqueue({ kind, recipient, payload: { token: 'legacy' } });
    assert.equal((await queue.claimBatch()).length, 0);
    assert.equal((await database.query('SELECT status FROM notification_outbox WHERE id=$1', [legacy])).rows[0].status, 'cancelled');
    console.log('Fila: códigos substituídos, expirados, de conta suspensa e recuperação legada cancelados; revalidação após reserva comprovada.');
  } finally { await database.close(); }
});
