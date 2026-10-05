import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiServer } from '../apps/api/server.js';
import { createAccountConsentService } from '../apps/api/account-consent-service.js';
import { loadConfig } from '../apps/api/config.js';

test('HTTP operational preferences authenticate, isolate account, prohibit extra keys and do not cache', async context => {
  let actor;
  let saved = 0;
  const service = createAccountConsentService({
    operationalPreferences: async user => { actor = user; return { configured: false, version: 0, channels: null, quietHours: null }; },
    saveOperationalPreferences: async (user, input) => { actor = user; saved++; return { preferences: { ...input, version: 1 }, reused: false }; },
  });
  const server = createApiServer({ config: loadConfig({ NODE_ENV: 'test' }), accountConsentService: service, authService: { async session(token) { return token === 'user' ? { id: 'user', role: 'customer' } : null; } } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  context.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/v1/account/operational-preferences`;
  assert.equal((await fetch(url)).status, 401);
  const headers = { cookie: 'fc_session=user', 'content-type': 'application/json' };
  const get = await fetch(url, { headers });
  assert.equal(get.status, 200);
  assert.equal(get.headers.get('cache-control'), 'no-store');
  const input = { expectedVersion: 0, channels: { email: false, sms: false, push: false }, quietHours: { enabled: false, start: null, end: null, timeZone: 'UTC' } };
  const put = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(input) });
  assert.equal(put.status, 200);
  assert.equal(put.headers.get('cache-control'), 'no-store');
  assert.equal(actor, 'user');
  assert.equal(saved, 1);
  const invalid = await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ ...input, userId: 'other' }) });
  assert.equal(invalid.status, 422);
  assert.equal(saved, 1);
});
