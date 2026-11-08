import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { validateCodexActionBoard } from '../tools/codex-action-board.mjs';

const [board, matrix] = await Promise.all([
  readFile(new URL('../config/codex-action-board.v1.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../docs/requirements-matrix.json', import.meta.url), 'utf8').then(JSON.parse),
]);
const clone = x => structuredClone(x);

test('Codex board covers each of the 28 open requirements exactly once and never promotes status', async () => {
  const actual = await validateCodexActionBoard(board, matrix);
  assert.deepEqual(actual, {
    denominator: 70, completed: 42, pending: 28, workstreams: 8,
    currentPercent: 60, targetPercent: 70,
    stillRequiresHumanApproval: true, pilotBH: 'NO-GO',
  });
  const ids = board.workstreams.flatMap(w => w.requirementIds);
  assert.equal(ids.length, 28);
  assert.equal(new Set(ids).size, 28);
  assert.equal(matrix.requirements.filter(r => r.status === 'concluido').length, 42);
});

test('Codex board rejects duplicated, removed, or auto-completed pending requirements', async () => {
  const duplicate = clone(board);
  duplicate.workstreams[1].requirementIds.push(duplicate.workstreams[0].requirementIds[0]);
  await assert.rejects(validateCodexActionBoard(duplicate, matrix), /duplicates or promotes/);
  const omitted = clone(board);
  omitted.workstreams[0].requirementIds.pop();
  await assert.rejects(validateCodexActionBoard(omitted, matrix), /cover every open requirement/);
  const fakeClosure = clone(matrix);
  fakeClosure.requirements.find(r => r.id === 41).status = 'concluido';
  await assert.rejects(validateCodexActionBoard(board, fakeClosure), /baseline is stale/);
});

test('Codex board refuses unauthorised feature activation, unsafe file refs and false targets', async () => {
  const unsafe = clone(board);
  unsafe.globalGates.pilotBH = 'GO';
  await assert.rejects(validateCodexActionBoard(unsafe, matrix), /safety gates/);
  const wrongTarget = clone(board);
  wrongTarget.planningTarget.percentCompleted = 100;
  await assert.rejects(validateCodexActionBoard(wrongTarget, matrix), /target is inconsistent/);
  const escape = clone(board);
  escape.workstreams[0].testPaths = ['../secret.test.mjs'];
  await assert.rejects(validateCodexActionBoard(escape, matrix), /test path/);
  const absent = clone(board);
  absent.workstreams[0].testPaths = ['tests/non-existent-test.test.mjs'];
  await assert.rejects(validateCodexActionBoard(absent, matrix), { code: 'ENOENT' });
});
