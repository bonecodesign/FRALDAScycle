import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedLocalApiOrigin, DEFAULT_LOCAL_API_ORIGIN } from '../packages/contracts/local-api-origin.js';
import { apiOrigin } from '../packages/contracts/api-client.js';
test('local surface and browser client share a loopback default', () => {
  assert.equal(approvedLocalApiOrigin(), DEFAULT_LOCAL_API_ORIGIN);
  assert.equal(apiOrigin({ dataset: {} }), DEFAULT_LOCAL_API_ORIGIN);
  assert.equal(approvedLocalApiOrigin('http://localhost:4200/'), 'http://localhost:4200');
  assert.equal(approvedLocalApiOrigin('http://127.0.0.1:4321'), 'http://127.0.0.1:4321');
});
test('local origin cannot grant access to external hosts, credentials, paths or parameters', () => {
  for (const url of ['http://example.test', 'https://127.0.0.1:4200', 'http://127.0.0.1.evil.test', 'http://user:pass@127.0.0.1:4200', 'http://127.0.0.1:4200/api', 'http://127.0.0.1:4200/?url=example.test', 'http://127.0.0.1:4200/#fragment', 'not-a-url']) assert.throws(() => approvedLocalApiOrigin(url));
});
