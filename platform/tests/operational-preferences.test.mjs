import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOperationalPreferences, optionalReminderIsQuiet, notificationDispatchDecision } from '../apps/api/operational-preferences.js';
import { createAccountConsentService } from '../apps/api/account-consent-service.js';
import { createOperationalPreferenceRepository } from '../database/operational-preference-repository.js';
import { createNotificationService } from '../apps/api/notifications.js';

const input = (extra = {}) => ({ channels: { email: true, sms: false, push: false }, quietHours: { enabled: true, start: '22:00', end: '08:00', timeZone: 'America/Sao_Paulo' }, expectedVersion: 0, ...extra });
function database() {
  const calls = [];
  const rows = new Map();
  let clock = 0;
  const query = async (sql, values) => {
    calls.push({ sql, values });
    if (/SELECT id FROM users/.test(sql)) return { rows: values[0] === 'missing' ? [] : [{ id: values[0] }] };
    if (/SELECT \* FROM account_operational_preferences/.test(sql)) return { rows: rows.has(values[0]) ? [rows.get(values[0])] : [] };
    if (/INSERT INTO account_operational_preferences/.test(sql)) {
      const [user_id, email, sms, push, quiet_enabled, quiet_start, quiet_end, time_zone] = values;
      const row = { user_id, email, sms, push, quiet_enabled, quiet_start, quiet_end, time_zone, version: (rows.get(user_id)?.version ?? 0) + 1, updated_at: ++clock };
      rows.set(user_id, row);
      return { rows: [row] };
    }
    return { rows: [] };
  };
  return { calls, query, async transaction(operation) { return operation({ query }); } };
}
test('absence is explicit and does not invent channels or quiet hours', async () => {
  const repo = createOperationalPreferenceRepository(database());
  assert.deepEqual(await repo.operationalPreferences('user'), { configured: false, version: 0, channels: null, quietHours: null, updatedAt: null });
});
test('strict input rejects attempts to change another account, marketing or terms', () => {
  const candidates = [null, [], { ...input(), userId: 'other' }, { ...input(), accepted: true }, { ...input(), marketing: true }, input({ expectedVersion: -1 }), input({ expectedVersion: 0.5 }), input({ channels: { email: 'true', sms: false, push: false } }), input({ channels: { email: true, sms: false } })];
  for (const candidate of candidates) assert.throws(() => validateOperationalPreferences(candidate), error => error.code === 'invalid_operational_preferences');
});
test('time format, range, timezone and disabled state are validated', () => {
  for (const quietHours of [
    { enabled: true, start: '24:00', end: '08:00', timeZone: 'UTC' },
    { enabled: true, start: '22:00', end: '22:00', timeZone: 'UTC' },
    { enabled: true, start: null, end: '08:00', timeZone: 'UTC' },
    { enabled: true, start: '22:00', end: '08:00', timeZone: 'invalid/timezone' },
    { enabled: false, start: '22:00', end: '08:00', timeZone: 'UTC' },
  ]) assert.throws(() => validateOperationalPreferences(input({ quietHours })), error => error.status === 422);
  assert.equal(validateOperationalPreferences(input({ quietHours: { enabled: false, start: null, end: null, timeZone: 'UTC' } })).quietHours.enabled, false);
});
test('local overnight window includes start, excludes end and uses selected timezone', () => {
  const preferences = { configured: true, ...input() };
  assert.equal(optionalReminderIsQuiet(preferences, '2026-10-05T00:59:00Z'), false);
  assert.equal(optionalReminderIsQuiet(preferences, '2026-10-05T01:00:00Z'), true);
  assert.equal(optionalReminderIsQuiet(preferences, '2026-10-05T10:59:00Z'), true);
  assert.equal(optionalReminderIsQuiet(preferences, '2026-10-05T11:00:00Z'), false);
  assert.equal(optionalReminderIsQuiet({ configured: false }, '2026-10-05T01:00:00Z'), false);
});
test('same-day window and daylight saving use actual instants rather than UTC offsets', () => {
  const preferences = { configured: true, ...input({ quietHours: { enabled: true, start: '01:00', end: '02:00', timeZone: 'America/New_York' } }) };
  assert.equal(optionalReminderIsQuiet(preferences, '2026-11-01T05:30:00Z'), true);
  assert.equal(optionalReminderIsQuiet(preferences, '2026-11-01T06:30:00Z'), true);
  assert.equal(optionalReminderIsQuiet(preferences, '2026-11-01T07:00:00Z'), false);
  assert.throws(() => optionalReminderIsQuiet(preferences, 'invalid'), RangeError);
});
test('save locks the account before first insert and atomically records history and audit', async () => {
  const db = database();
  const service = createAccountConsentService(createOperationalPreferenceRepository(db));
  const result = await service.saveOperationalPreferences('user', input());
  assert.equal(result.preferences.version, 1);
  assert.equal(result.reused, false);
  assert.match(db.calls[0].sql, /SELECT id FROM users.*FOR UPDATE/);
  assert.equal(db.calls.length, 5);
  assert.match(db.calls[3].sql, /operational_preference_events/);
  assert.match(db.calls[4].sql, /account.operational_preferences.changed/);
  assert.ok(db.calls.every(call => !/marketing|terms_acceptances|notification_outbox/.test(call.sql)));
});
test('identical retry preserves version, timestamp and a single history entry regardless of channel key order', async () => {
  const db = database();
  const service = createAccountConsentService(createOperationalPreferenceRepository(db));
  const first = await service.saveOperationalPreferences('user', input());
  const second = await service.saveOperationalPreferences('user', input({ channels: { sms: false, push: false, email: true } }));
  assert.equal(second.reused, true);
  assert.deepEqual(first.preferences, second.preferences);
  assert.equal(db.calls.filter(call => /INSERT INTO operational_preference_events/.test(call.sql)).length, 1);
});
test('stale different write conflicts and cannot overwrite another tab', async () => {
  const db = database();
  const repo = createOperationalPreferenceRepository(db);
  await repo.saveOperationalPreferences('user', validateOperationalPreferences(input()));
  await assert.rejects(repo.saveOperationalPreferences('user', validateOperationalPreferences(input({ channels: { email: false, sms: true, push: true } }))), error => error.status === 409);
  assert.equal((await repo.operationalPreferences('user')).channels.email, true);
  assert.equal(db.calls.filter(call => /INSERT INTO operational_preference_events/.test(call.sql)).length, 1);
});
test('valid version allows changing channels and disabling quiet hours without marketing writes', async () => {
  const db = database();
  const repo = createOperationalPreferenceRepository(db);
  await repo.saveOperationalPreferences('user', validateOperationalPreferences(input()));
  const result = await repo.saveOperationalPreferences('user', validateOperationalPreferences(input({ expectedVersion: 1, quietHours: { enabled: false, start: null, end: null, timeZone: 'UTC' } })));
  assert.equal(result.preferences.version, 2);
  assert.equal(result.preferences.quietHours.start, null);
  assert.ok(db.calls.every(call => !/account_marketing_preferences/.test(call.sql)));
});
test('data is isolated by authenticated account and absent user cannot write', async () => {
  const db = database();
  const repo = createOperationalPreferenceRepository(db);
  await repo.saveOperationalPreferences('user', validateOperationalPreferences(input()));
  assert.equal((await repo.operationalPreferences('other')).configured, false);
  await assert.rejects(repo.saveOperationalPreferences('missing', validateOperationalPreferences(input())), error => error.status === 404);
});
test('security notices are independent from quiet hours and promotional preferences', async () => {
  const jobs = [];
  const service = createNotificationService({ enqueue: async message => { jobs.push(message); return 'test-job'; } });
  await service.verification({ email: 'synthetic@example.test', token: 'test' });
  await service.passwordRecovery({ email: 'synthetic@example.test', token: 'test' });
  assert.deepEqual(jobs.map(job => job.kind), ['email_verification', 'password_recovery']);
});

test('approved quiet-hours policy exempts security, payment, cancellation and delivery exception notices', () => {
  const preferences = { configured: true, ...input() };
  for (const kind of ['email_verification', 'password_recovery', 'admin_login_mfa', 'security_alert', 'payment_status', 'payment_dispute', 'transaction_cancellation', 'delivery_exception']) {
    assert.equal(notificationDispatchDecision(kind, preferences, '2026-10-05T02:00:00Z'), 'deliver', kind);
  }
});

test('approved optional reminders defer only inside quiet hours and unknown kinds are not silently held', () => {
  const preferences = { configured: true, ...input() };
  for (const kind of ['payment_reminder', 'delivery_reminder', 'general_reminder']) {
    assert.equal(notificationDispatchDecision(kind, preferences, '2026-10-05T02:00:00Z'), 'defer', kind);
    assert.equal(notificationDispatchDecision(kind, preferences, '2026-10-05T12:00:00Z'), 'deliver', kind);
  }
  assert.equal(notificationDispatchDecision('future_notice', preferences, '2026-10-05T02:00:00Z'), 'unclassified');
});
