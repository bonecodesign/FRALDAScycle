import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { validateCrossFunctionalDecisionGates } from '../tools/cross-functional-decision-gates.mjs';

const [plan, matrix, board] = await Promise.all([
  readFile(new URL('../config/cross-functional-decision-gates.v1.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../docs/requirements-matrix.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../config/codex-action-board.v1.json', import.meta.url), 'utf8').then(JSON.parse),
]);
const clone = structuredClone;

test('three packets are evidence-linked and track 22 pending IDs; 21 human decisions stay unapproved', async () => {
  assert.deepEqual(await validateCrossFunctionalDecisionGates(plan, matrix, board), {
    currentPercent: 60, pendingCount: 28, inThreeTracks: 22,
    outsideThreeTracks: 6, humanDecisionsPending: 21,
    approvalsRecorded: 0, pilotBH: 'NO-GO',
  });
});

test('no automated test, documentation or reviewer placeholder can mark a human gate approved', async () => {
  const changed = clone(plan);
  changed.tracks[0].gates[0].status = 'approved';
  await assert.rejects(validateCrossFunctionalDecisionGates(changed, matrix, board),
    /silently approved/);
  const fakeEvidence = clone(plan);
  fakeEvidence.tracks[1].gates[2].evidenceReference = 'synthetic-test-only';
  await assert.rejects(validateCrossFunctionalDecisionGates(fakeEvidence, matrix, board),
    /silently approved/);
  const fakeSignature = clone(plan);
  fakeSignature.tracks[2].gates[3].approvalReference = 'fake-signature';
  await assert.rejects(validateCrossFunctionalDecisionGates(fakeSignature, matrix, board),
    /silently approved/);
});

test('pending coverage and formal matrix cannot be silently shifted', async () => {
  const omitted = clone(plan);
  omitted.tracks[0].requirementIds.pop();
  await assert.rejects(validateCrossFunctionalDecisionGates(omitted, matrix, board),
    /Unexpected review track/);
  const changed = clone(matrix);
  changed.requirements.find(x => x.id === 26).status = 'concluido';
  await assert.rejects(validateCrossFunctionalDecisionGates(plan, changed, board),
    /stale relative/);
  const changedBoard = clone(board);
  changedBoard.workstreams[0].requirementIds.push(26);
  await assert.rejects(validateCrossFunctionalDecisionGates(plan, matrix, changedBoard),
    /does not match/);
  const touchedOther = clone(plan);
  touchedOther.otherPendingRequirementIds.push(26);
  await assert.rejects(validateCrossFunctionalDecisionGates(touchedOther, matrix, board),
    /preserve the rest/);
});

test('pilot, provider, credentials and activation remain forbidden', async () => {
  for (const field of [
    'noGo', 'allowsRealData', 'allowsExternalProviderAccess',
    'allowsRealPayments', 'allowsPromotion', 'allowsFeatureActivation',
  ]) {
    const changed = clone(plan);
    changed[field] = !changed[field];
    await assert.rejects(validateCrossFunctionalDecisionGates(changed, matrix, board),
      /cannot enable operation/);
  }
});

test('all 21 gate IDs, file paths and reviewer roles must be meaningful', async () => {
  const changed = clone(plan);
  changed.tracks[0].gates[0].id = changed.tracks[0].gates[1].id;
  await assert.rejects(validateCrossFunctionalDecisionGates(changed, matrix, board),
    /duplicated/);
  const changedRole = clone(plan);
  changedRole.tracks[0].gates[0].requiredRoles.push('codex');
  await assert.rejects(validateCrossFunctionalDecisionGates(changedRole, matrix, board),
    /human reviewers/);
  const escaped = clone(plan);
  escaped.tracks[1].testPaths[0] = '../secrets.js';
  await assert.rejects(validateCrossFunctionalDecisionGates(escaped, matrix, board),
    /Invalid proof-of-work test path/);
  const missingDoc = clone(plan);
  missingDoc.tracks[2].doc = 'docs/approval-packets/missing.md';
  await assert.rejects(validateCrossFunctionalDecisionGates(missingDoc, matrix, board),
    { code: 'ENOENT' });
});
