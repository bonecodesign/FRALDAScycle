import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthService, hashSessionToken } from '../apps/api/auth-service.js';

function fixture() {
  const tokens = new Map(), sent = [], resets = [];
  const repository = {
    async reservePasswordRecoveryRequest() { return true; },
    async findUserByContact({ email }) { return email === 'active@example.test' ? { id: 'owner', email } : null; },
    async createAuthToken(input) {
      assert.match(input.notification.token, /^\d{6}$/);
      tokens.clear(); tokens.set(input.tokenHash.toString('hex'), input);
      sent.push(input.notification);
    },
    async resetPasswordWithToken(input) {
      resets.push(input);
      const key = input.tokenHash.toString('hex'), record = tokens.get(key);
      if (!record) return null;
      tokens.delete(key); return record.userId;
    },
  };
  const auth = createAuthService(repository);
  return { auth, repository, sent, resets, tokens };
}

test('recovery binds a code to its unpredictable challenge and invalidates earlier requests', async () => {
  const { auth, sent, tokens, resets } = fixture();
  const first = await auth.requestPasswordRecovery({ email: 'active@example.test' });
  const firstCode = sent.at(-1).token;
  assert.ok(tokens.has(hashSessionToken(`password-recovery:${first.challenge}.${firstCode}`).toString('hex')));
  const second = await auth.requestPasswordRecovery({ email: 'active@example.test' });
  const code = sent.at(-1).token, password = 'new-password-synthetic';
  assert.notEqual(first.challenge, second.challenge);
  await assert.rejects(auth.resetPassword({ challenge: first.challenge, token: code, password }), error => error.code === 'invalid_or_expired_token');
  await assert.rejects(auth.resetPassword({ token: code, password }), error => error.code === 'invalid_or_expired_token');
  assert.deepEqual(await auth.resetPassword({ challenge: second.challenge, token: code, password }), { success: true });
  await assert.rejects(auth.resetPassword({ challenge: second.challenge, token: code, password }), error => error.code === 'invalid_or_expired_token');
  assert.equal(resets.at(-1).attemptHash.length, 32);
  assert.equal(resets.at(-1).maxAttempts, 5);
});

test('recovery returns the same public fields for active and nonexistent accounts', async () => {
  const { auth, sent } = fixture();
  const existing = await auth.requestPasswordRecovery({ email: 'active@example.test' });
  const missing = await auth.requestPasswordRecovery({ email: 'missing@example.test' });
  assert.deepEqual(Object.keys(existing), Object.keys(missing));
  assert.equal(existing.accepted, true); assert.equal(missing.accepted, true);
  assert.match(missing.challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(sent.length, 1);
});

test('recovery translates the atomic attempt limit into a retry request', async () => {
  const { auth, repository, sent } = fixture();
  const { challenge } = await auth.requestPasswordRecovery({ email: 'active@example.test' });
  repository.resetPasswordWithToken = async () => ({ limited: true });
  await assert.rejects(auth.resetPassword({ challenge, token: sent.at(-1).token, password: 'new-password-synthetic' }), error => error.code === 'too_many_attempts' && error.status === 429);
});

test('recovery throttles normalized contacts before looking up accounts or emitting codes', async () => {
  const { auth, repository, sent } = fixture();
  const hashes = [], contacts = [];
  const find = repository.findUserByContact;
  repository.findUserByContact = async contact => { contacts.push(contact); return find(contact); };
  repository.reservePasswordRecoveryRequest = async identityHash => { hashes.push(identityHash.toString('hex')); return hashes.length === 1; };
  await auth.requestPasswordRecovery({ email: ' ACTIVE@EXAMPLE.TEST ', phone: '(31) 99900-0000' });
  await assert.rejects(auth.requestPasswordRecovery({ email: 'active@example.test' }), error => error.code === 'recovery_request_limited' && error.status === 429);
  assert.equal(hashes[0], hashes[1]);
  assert.deepEqual(contacts, [{ email: 'active@example.test', phone: null }]);
  assert.equal(sent.length, 1);
  assert.equal(hashes[0].length, 64);
  // Unknown contacts obey the same limit without an account lookup.
  await assert.rejects(auth.requestPasswordRecovery({ email: 'missing@example.test' }), error => error.code === 'recovery_request_limited' && error.status === 429);
  assert.equal(contacts.length, 1);
  const count = hashes.length;
  await assert.rejects(auth.requestPasswordRecovery({ email: 'invalid' }), error => error.code === 'invalid_email');
  assert.equal(hashes.length, count);
});

test('recovery rate limits share the same key across equivalent phone formats', async () => {
  const { auth, repository } = fixture();
  const hashes = [];
  repository.reservePasswordRecoveryRequest = async identityHash => { hashes.push(identityHash.toString('hex')); return true; };
  await auth.requestPasswordRecovery({ phone: '(31) 99900-0000' });
  await auth.requestPasswordRecovery({ phone: '31999000000' });
  assert.equal(hashes[0], hashes[1]);
});
