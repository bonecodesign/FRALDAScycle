import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthService, hashSessionToken } from '../apps/api/auth-service.js';

test('account verification binds codes to challenges, replaces them and throttles normalized contacts', async () => {
  let issued, allow = true, lookups = 0;
  const hashes = [];
  const user = { id: 'synthetic', email: 'active@example.test', role: 'customer' };
  const repository = {
    async reserveVerificationRequest(hash) { hashes.push(hash.toString('hex')); return allow; },
    async findUserByContact(contact) { lookups++; assert.equal(contact.phone, null); return contact.email === user.email ? user : null; },
    async createAuthToken(input) { issued = input; return 'token-id'; },
    async confirmVerificationToken({ tokenHash, attemptHash, maxAttempts }) {
      assert.equal(attemptHash.length, 32); assert.equal(maxAttempts, 5);
      if (!issued || !issued.tokenHash.equals(tokenHash)) return { user: null };
      issued = null; return { user: { ...user, email_verified_at: new Date() } };
    },
  };
  const auth = createAuthService(repository);
  const first = await auth.requestVerification({ email: 'ACTIVE@EXAMPLE.TEST', phone: '31999000000' });
  const code = issued.notification.token;
  assert.ok(issued.tokenHash.equals(hashSessionToken(`account-verification:${first.challenge}.${code}`)));
  const second = await auth.requestVerification({ email: user.email });
  const nextCode = issued.notification.token;
  assert.equal(hashes[0], hashes[1]);
  await assert.rejects(auth.verifyEmail({ token: nextCode }), error => error.code === 'invalid_or_expired_token');
  await assert.rejects(auth.verifyEmail({ token: nextCode, challenge: first.challenge }), error => error.code === 'invalid_or_expired_token');
  allow = false;
  await assert.rejects(auth.requestVerification({ email: user.email }), error => error.code === 'verification_request_limited' && error.status === 429);
  assert.equal(lookups, 2);
  assert.equal((await auth.verifyEmail({ token: nextCode, challenge: second.challenge })).user.emailVerified, true);
  await assert.rejects(auth.verifyEmail({ token: nextCode, challenge: second.challenge }), error => error.code === 'invalid_or_expired_token');
  allow = true;
  const missing = await auth.requestVerification({ email: 'missing@example.test' });
  assert.deepEqual(Object.keys(missing), Object.keys(first));
  assert.equal(missing.accepted, true); assert.match(missing.challenge, /^[A-Za-z0-9_-]{43}$/);
  repository.confirmVerificationToken = async () => ({ limited: true });
  await assert.rejects(auth.verifyEmail({ token: '123456', challenge: second.challenge }), error => error.code === 'too_many_attempts' && error.status === 429);
});
