import test from 'node:test';
import assert from 'node:assert/strict';
import { createProofReviewController } from '../apps/admin/proof-review-controller.js';
import { createMarketplaceProviders } from '../apps/api/marketplace-providers.js';
import { createLogisticsService } from '../apps/api/logistics-service.js';
const id = '22222222-2222-4222-8222-222222222222';
function controller(options = {}) {
  const calls = [];
  const instance = createProofReviewController({
    now: () => 1000,
    showPhoto: async () => {},
    request: async (path, input) => {
      calls.push({ path, input });
      if (path.endsWith('/session')) return { user: { role: 'admin' } };
      if (path.endsWith('/proof')) return { proof: { id: 'proof', validatedAt: null } };
      if (path.endsWith('/photo')) return { image: { readUrl: 'https://media.example.test/photo', expiresAt: new Date(5000).toISOString() } };
      return { decision: { reused: false } };
    }, ...options,
  });
  return { instance, calls };
}
test('review loads private photo before validating and blocks duplicate submit', async () => {
  const { instance, calls } = controller();
  await assert.rejects(instance.validate('Foto conferida.', true));
  await instance.load(id);
  await instance.validate('Foto conferida.', true);
  assert.equal(calls.at(-1).path, `/v1/shipments/${id}/proof/validate`);
  assert.deepEqual(calls.at(-1).input.body, { validated: true, reason: 'Foto conferida.' });
  await assert.rejects(instance.validate('Foto conferida.', true));
});
test('unloaded, failed, expired or changed photo cannot be validated', async () => {
  const failed = controller({ showPhoto: async () => { throw new Error('failed'); } }).instance;
  await assert.rejects(failed.load(id));
  await assert.rejects(failed.validate('Foto conferida.', true));
  let time = 1000;
  const { instance } = controller({ now: () => time });
  await instance.load(id);
  time = 5001;
  await assert.rejects(instance.validate('Foto conferida.', true));
  time = 1000;
  await instance.load(id);
  instance.clear();
  await assert.rejects(instance.validate('Foto conferida.', true));
});
test('moderator cannot load administrative review', async () => {
  const { instance } = controller({ request: async () => ({ user: { role: 'moderator' } }) });
  await assert.rejects(instance.load(id), /Somente administradores/);
});
test('photo authorization precedes any provider request', async () => {
  let called = false;
  const service = createLogisticsService({ receiptEvidence: async () => null }, {}, {
    signedProofRead: async () => { called = true; },
  });
  await assert.rejects(service.proofPhoto({ id: 'outsider', role: 'customer' }, id), error => error.code === 'receipt_not_found');
  assert.equal(called, false);
});
test('media read requires credentials and rejects insecure or excessive expiry', async () => {
  await assert.rejects(createMarketplaceProviders({}).signedProofRead('admin', 'proofs/photo'), error => error.code === 'provider_not_configured');
  const config = { mediaProviderUrl: 'https://media.example.test', mediaProviderSecret: 'synthetic-test' };
  for (const value of [
    { readUrl: 'http://media.example.test', expiresAt: new Date(Date.now() + 60000).toISOString() },
    { readUrl: 'https://media.example.test', expiresAt: new Date(Date.now() + 600000).toISOString() },
    { readUrl: 'https://media.example.test', expiresAt: 'invalid' },
  ]) {
    const provider = createMarketplaceProviders(config, async () => new Response(JSON.stringify(value)));
    await assert.rejects(provider.signedProofRead('admin', 'proofs/photo'), error => error.code === 'invalid_provider_response');
  }
  let payload;
  const provider = createMarketplaceProviders(config, async (url, options) => {
    payload = JSON.parse(options.body);
    return new Response(JSON.stringify({ readUrl: 'https://media.example.test/photo', expiresAt: new Date(Date.now() + 60000).toISOString() }));
  });
  assert.match((await provider.signedProofRead('admin', 'proofs/photo')).readUrl, /^https:/);
  assert.equal(payload.expiresInSeconds, 300);
  assert.equal(payload.storageKey, 'proofs/photo');
});

test('photo HTTP endpoint authenticates and disables caching of signed URLs', async context => {
  const { createApiServer } = await import('../apps/api/server.js');
  const { loadConfig } = await import('../apps/api/config.js');
  const server = createApiServer({ config: loadConfig({ NODE_ENV: 'test' }),
    authService: { async session(token) { return token === 'admin' ? { id: 'reviewer', role: 'admin' } : null; } },
    logisticsService: { async proofPhoto(actor, shipmentId) {
      assert.equal(actor.id, 'reviewer');
      assert.equal(shipmentId, id);
      return { readUrl: 'https://media.example.test/photo', expiresAt: new Date(Date.now() + 60000).toISOString() };
    } },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  context.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/v1/shipments/${id}/proof/photo`;
  assert.equal((await fetch(url)).status, 401);
  const response = await fetch(url, { headers: { cookie: 'fc_session=admin' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match((await response.json()).image.readUrl, /^https:/);
});
