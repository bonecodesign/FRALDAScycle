import assert from 'node:assert/strict';
import test from 'node:test';
import { createChildProfileService } from '../apps/api/child-profile-service.js';
import { CHILD_PROFILE_CONSENT_VERSION } from '../packages/contracts/child-age-band.js';

const actor = { id: 'synthetic-adult-account', role: 'customer', adultDeclared: true };
const reference = new Date('2026-11-23T12:00:00.000Z');
const current = birth_date => ({
  birth_date, personalization_enabled: true,
  consent_version: CHILD_PROFILE_CONSENT_VERSION,
  responsibility_suspended_at: null,
});

test('PRIV-01/05: only current, explicit profile consent can produce internal age-band signals', async () => {
  const rows = [
    current('2026-07-01'),
    current('2026-07-15'), // deduplicates the same age band
    current('2026-10-01'),
    { ...current('2024-04-01'), consent_version: 'FC-CHILD-PROFILE-OLD' },
    { ...current('2023-04-01'), consent_version: null },
    { ...current('2025-04-01'), personalization_enabled: false },
    { ...current('2022-04-01'), responsibility_suspended_at: '2026-11-20T00:00:00.000Z' },
  ];
  let lists = 0, clocks = 0;
  const service = createChildProfileService({
    async list(id) {
      assert.equal(id, actor.id);
      lists += 1;
      return rows;
    },
  }, { featureEnabled: true, now: () => { clocks += 1; return reference; } });
  const signals = await service.personalizationSignals(actor);
  assert.deepEqual(signals, [{ ageBand: 'infant_3_5' }, { ageBand: 'newborn_0_2' }]);
  assert.equal(lists, 1);
  assert.equal(clocks, 1, 'all rows must use the same date snapshot');
  assert.ok(signals.every(signal => Object.keys(signal).join(',') === 'ageBand'));
  assert.equal(JSON.stringify(signals).includes('2026-'), false);
  assert.equal(JSON.stringify(signals).includes('synthetic-adult-account'), false);
});

test('PRIV-01: delayed age-limit cleanup and malformed birth dates cannot issue personalization signals', async () => {
  const rows = [
    current('2013-11-01'), // already 13, even if lifecycle worker has not run
    current('2027-01-01'), // future date
    current('bad-date'),
    current(null),
    current(new Date('invalid')),
    current('2020-05-01'), // valid signal survives invalid neighboring rows
  ];
  const service = createChildProfileService({ async list() { return rows; } }, {
    featureEnabled: true, now: () => reference,
  });
  assert.deepEqual(await service.personalizationSignals(actor), [{ ageBand: 'child_36_plus' }]);
  rows.pop();
  assert.deepEqual(await service.personalizationSignals(actor), []);
});

test('PRIV-03: disabled feature and non-family actors cannot read age signals', async () => {
  let reads = 0;
  const repository = { async list() { reads += 1; return [current('2026-07-01')]; } };
  const disabled = createChildProfileService(repository, { now: () => reference });
  await assert.rejects(disabled.personalizationSignals(actor), error =>
    error.code === 'child_profiles_disabled' && error.status === 404);
  const enabled = createChildProfileService(repository, { featureEnabled: true, now: () => reference });
  for (const role of ['courier', 'admin', 'moderator']) {
    await assert.rejects(enabled.personalizationSignals({ ...actor, role }), error =>
      error.code === 'family_profile_not_available' && error.status === 403);
  }
  await assert.rejects(enabled.personalizationSignals({ ...actor, adultDeclared: false }), error =>
    error.status === 403);
  assert.equal(reads, 0, 'all unauthorized calls must be rejected before any repository read');
});
