import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isMainModule } from '../packages/contracts/main-module.js';

export async function validateCodexActionBoard(board, matrix, root = resolve(import.meta.dirname, '..')) {
  if (board?.schemaVersion !== 1 || board.sourceOfTruth !== 'docs/requirements-matrix.json') {
    throw new Error('Codex board schema or source of truth invalid.');
  }
  const all = matrix.requirements;
  if (matrix.denominator !== 70 || !Array.isArray(all) || all.length !== 70) {
    throw new Error('Codex board requires the official 70-requirement matrix.');
  }
  const counts = { concluido: 0, parcial: 0, bloqueado: 0, pendente: 0 };
  const pending = new Set();
  for (const item of all) {
    if (!Object.hasOwn(counts, item.status)) throw new Error('Unknown requirement state.');
    counts[item.status]++;
    if (item.status !== 'concluido') pending.add(item.id);
  }
  const b = board.baseline;
  if (b.denominator !== 70 || b.concluido !== counts.concluido ||
      b.parcial !== counts.parcial || b.bloqueado !== counts.bloqueado ||
      b.percentCompleted !== Number((counts.concluido / 70 * 100).toFixed(2))) {
    throw new Error('Codex board baseline is stale: refresh it against the current matrix.');
  }
  const target = board.planningTarget;
  if (!Number.isInteger(target.completedCount) || target.completedCount > 70 ||
      target.completedCount < counts.concluido ||
      target.additionalCompletedRequired !== target.completedCount - counts.concluido ||
      target.percentCompleted !== Number((target.completedCount / 70 * 100).toFixed(2))) {
    throw new Error('Codex board planning target is inconsistent.');
  }
  if (board.globalGates?.prototypeImmutable !== true ||
      board.globalGates.changesOnlyWithin !== 'platform/' ||
      board.globalGates.requireHumanApprovalForPromotion !== true ||
      board.globalGates.pilotBH !== 'NO-GO' ||
      board.globalGates.noPaidServices !== true ||
      board.globalGates.noExternalPublication !== true ||
      board.globalGates.noRealCredentials !== true ||
      board.globalGates.autonomousOrchestration !== 'planned-not-authorized') {
    throw new Error('Codex board must preserve all project safety gates.');
  }
  const expectedJobs = ['foundation', 'listing-postgres', 'containers', 'browser-postgres'];
  if (JSON.stringify(board.globalGates.requiredCiJobs) !== JSON.stringify(expectedJobs)) {
    throw new Error('Codex board must retain all 4 required CI jobs.');
  }
  if (!Array.isArray(board.workstreams) || !board.workstreams.length) {
    throw new Error('Codex board needs prioritized workstreams.');
  }
  const ids = new Set(), keys = new Set(), orders = new Set();
  for (const w of board.workstreams) {
    if (!w.id || keys.has(w.id) || !Number.isInteger(w.order) || orders.has(w.order) ||
        !Array.isArray(w.requirementIds) || !w.requirementIds.length ||
        !w.codexNow?.trim() || !w.nextEvidence?.trim() ||
        !Array.isArray(w.humanBlockers) || !w.humanBlockers.length ||
        !w.humanBlockers.every(x => typeof x === 'string' && x.trim()) ||
        !Array.isArray(w.testPaths) || !w.testPaths.length) {
      throw new Error('Codex workstream invalid or lacks actionable evidence and human gates.');
    }
    keys.add(w.id);
    orders.add(w.order);
    for (const id of w.requirementIds) {
      if (!pending.has(id) || ids.has(id)) {
        throw new Error('Codex board duplicates or promotes a requirement without evidence.');
      }
      ids.add(id);
    }
    for (const path of w.testPaths) {
      if (!/^tests\\/[a-z0-9-]+\\.test\\.mjs$/.test(path) || path.includes('..')) {
        throw new Error('Codex board test path must stay in platform/tests/.');
      }
      await access(resolve(root, path));
    }
  }
  if (ids.size !== pending.size) {
    throw new Error('Codex board must cover every open requirement exactly once.');
  }
  return {
    denominator: 70,
    completed: counts.concluido,
    pending: pending.size,
    workstreams: board.workstreams.length,
    currentPercent: b.percentCompleted,
    targetPercent: target.percentCompleted,
    stillRequiresHumanApproval: true,
    pilotBH: 'NO-GO',
  };
}

if (isMainModule(import.meta.url)) {
  const board = JSON.parse(await readFile(new URL('../config/codex-action-board.v1.json', import.meta.url), 'utf8'));
  const matrix = JSON.parse(await readFile(new URL('../docs/requirements-matrix.json', import.meta.url), 'utf8'));
  console.log(JSON.stringify(await validateCodexActionBoard(board, matrix), null, 2));
}
