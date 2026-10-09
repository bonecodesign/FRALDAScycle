import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../apps/admin/auth.js', import.meta.url), 'utf8');
const start = source.indexOf('function showLoginError('), end = source.indexOf('async function requireAdmin(');
assert.ok(start >= 0 && end > start);

async function fixture(request) {
  let now = 1_000_000, nextTimer = 0;
  const timers = new Map(), calls = [], navigation = [];
  const input = () => ({ value: '', focus() {} });
  const form = () => ({ hidden: false, elements: {}, handlers: {}, button: { disabled: false },
    querySelector() { return this.button; }, addEventListener(name, handler) { this.handlers[name] = handler; } });
  const login = form(), mfa = form(), restart = form();
  login.elements = { email: input(), password: input() }; mfa.elements = { code: input() }; mfa.hidden = true;
  login.elements.email.value = 'admin@example.test'; login.elements.password.value = 'synthetic-password';
  const loginError = { textContent: '' }, codeError = { textContent: '' };
  const ids = { 'admin-login-form': login, 'admin-mfa-form': mfa, 'admin-mfa-restart': restart,
    'admin-login-error': loginError, 'admin-mfa-error': codeError };
  const api = async (path, options) => {
    calls.push([path, options]);
    if (path === '/v1/auth/session') return { user: null };
    return request(path, options);
  };
  const setup = new Function('apiRequest', 'document', 'location', 'setInterval', 'clearInterval', 'Date',
    `const ADMIN_ROLES = new Set(['admin','moderator']);\n${source.slice(start,end)}\nreturn handleLogin();`);
  await setup(api, { getElementById: id => ids[id] }, { replace: path => navigation.push(path) },
    callback => { timers.set(++nextTimer, callback); return nextTimer; }, id => timers.delete(id), { now: () => now, parse: Date.parse });
  const fire = (target, event = 'submit') => target.handlers[event]({ preventDefault() {} });
  return { login, mfa, restart, loginError, codeError, calls, navigation, timers, fire,
    challenge: () => ({ mfaRequired: true, challenge: 'a'.repeat(43), expiresAt: new Date(now + 300_000).toISOString() }),
    expire() { now += 301_000; for (const callback of [...timers.values()]) callback(); } };
}

test('admin UI clears password and navigates only after successful API confirmation', async () => {
  let state, correct = false;
  state = await fixture(async path => {
    if (path === '/v1/auth/login') return state.challenge();
    if (!correct) throw Object.assign(new Error('Código inválido'), { status: 422 });
    return { user: { role: 'admin' } };
  });
  await state.fire(state.login);
  assert.equal(state.login.elements.password.value, ''); assert.equal(state.mfa.hidden, false);
  state.mfa.elements.code.value = '123456'; await state.fire(state.mfa);
  assert.equal(state.navigation.length, 0); assert.equal(state.codeError.textContent, 'Código inválido');
  correct = true; await state.fire(state.mfa);
  assert.deepEqual(state.navigation, ['/admin/dashboard']); assert.equal(state.timers.size, 0);
});

test('admin UI prevents duplicate submissions and restart during pending confirmation', async () => {
  let state, finish;
  state = await fixture(async path => path === '/v1/auth/login' ? state.challenge() : new Promise(resolve => { finish = resolve; }));
  const login = state.fire(state.login); await state.fire(state.login); await login;
  state.mfa.elements.code.value = '123456';
  const confirmation = state.fire(state.mfa);
  await state.fire(state.mfa); await state.fire(state.restart, 'click');
  assert.equal(state.login.hidden, true);
  assert.equal(state.calls.filter(([path]) => path === '/v1/auth/login').length, 1);
  assert.equal(state.calls.filter(([path]) => path === '/v1/auth/mfa/confirm').length, 1);
  finish({ user: { role: 'moderator' } }); await confirmation;
  assert.deepEqual(state.navigation, ['/admin/dashboard']);
});

test('admin UI expires challenges and restarts with empty credentials', async () => {
  let state; state = await fixture(async () => state.challenge());
  await state.fire(state.login); state.mfa.elements.code.value = '123456'; state.expire();
  assert.equal(state.mfa.button.disabled, true); assert.equal(state.mfa.elements.code.value, '');
  await state.fire(state.mfa);
  assert.equal(state.calls.filter(([path]) => path === '/v1/auth/mfa/confirm').length, 0);
  await state.fire(state.restart, 'click');
  assert.equal(state.login.hidden, false); assert.equal(state.mfa.hidden, true);
  assert.equal(state.codeError.textContent, ''); assert.equal(state.login.elements.password.value, '');
});

test('admin UI requires restart after the API attempt limit', async () => {
  let state; state = await fixture(async path => {
    if (path === '/v1/auth/login') return state.challenge();
    throw Object.assign(new Error('Muitas tentativas'), { status: 429 });
  });
  await state.fire(state.login); state.mfa.elements.code.value = '123456'; await state.fire(state.mfa);
  assert.equal(state.mfa.button.disabled, true); await state.fire(state.mfa);
  assert.equal(state.calls.filter(([path]) => path === '/v1/auth/mfa/confirm').length, 1);
  assert.equal(state.navigation.length, 0);
});

test('admin UI rejects single-factor privileged responses and malformed challenges', async () => {
  for (const response of [{ user: { role: 'admin' } }, { mfaRequired: true, challenge: 'invalid', expiresAt: new Date().toISOString() }]) {
    const state = await fixture(async () => response);
    await state.fire(state.login);
    assert.equal(state.navigation.length, 0); assert.equal(state.mfa.hidden, true);
    assert.ok(state.loginError.textContent);
  }
});

test('admin UI logs out if confirmation returns an unauthorized role', async () => {
  let state; state = await fixture(async path => path === '/v1/auth/login' ? state.challenge() : { user: { role: 'customer' } });
  await state.fire(state.login); state.mfa.elements.code.value = '123456'; await state.fire(state.mfa);
  assert.equal(state.navigation.length, 0);
  assert.equal(state.calls.filter(([path]) => path === '/v1/auth/logout').length, 1);
});
