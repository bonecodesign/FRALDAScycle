import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isMainModule } from '../packages/contracts/main-module.js';

const EXPECTED = {
  PRIV: [26, 27, 28, 31, 32, 33, 45, 46],
  FIN: [2, 3, 9, 10, 11, 12, 17],
  OPS: [18, 51, 56, 62, 67],
};
const ALLOWED_ROLES = new Set([
  'juridico', 'privacidade', 'produto', 'seguranca', 'financeiro',
  'contabilidade', 'suporte', 'operacao', 'governanca', 'acessibilidade',
]);

function equalMembers(a, b) {
  return Array.isArray(a) && a.length === b.length &&
    new Set(a).size === a.length && b.every(x => a.includes(x));
}

export async function validateCrossFunctionalDecisionGates(
  plan, matrix, codexBoard, root = resolve(import.meta.dirname, '..')
) {
  if (plan?.schemaVersion !== 1 || plan.sourceMatrix !== 'docs/requirements-matrix.json' ||
      plan.sourceCodexBoard !== 'config/codex-action-board.v1.json' ||
      plan.state !== 'preparation_only' || plan.noGo !== true ||
      plan.allowsRealData !== false || plan.allowsExternalProviderAccess !== false ||
      plan.allowsRealPayments !== false || plan.allowsPromotion !== false ||
      plan.allowsFeatureActivation !== false) {
    throw new Error('Cross-functional plan cannot enable operation or override approval gates.');
  }
  if (matrix?.denominator !== 70 || matrix.requirements?.length !== 70) {
    throw new Error('Expected the canonical matrix of exactly 70 requirements.');
  }
  const counts = { concluido: 0, parcial: 0, bloqueado: 0, pendente: 0 };
  const pendingIds = [];
  for (const r of matrix.requirements) {
    if (!Object.hasOwn(counts, r.status)) throw new Error('Unexpected requirement status.');
    counts[r.status]++;
    if (r.status !== 'concluido') pendingIds.push(r.id);
  }
  const snapshot = plan.countsAtCreation;
  if (snapshot?.denominator !== 70 || snapshot.completed !== counts.concluido ||
      snapshot.partial !== counts.parcial || snapshot.blocked !== counts.bloqueado) {
    throw new Error('Cross-functional plan is stale relative to the official matrix.');
  }
  const boardIds = codexBoard?.workstreams?.flatMap(w => w.requirementIds) ?? [];
  if (!equalMembers(boardIds, pendingIds)) {
    throw new Error('Codex backlog does not match the official pending requirements.');
  }
  if (!Array.isArray(plan.tracks) || plan.tracks.length !== 3) {
    throw new Error('Exactly three cross-functional review tracks are required.');
  }
  const touched = [], gateIds = new Set(), trackIds = new Set();
  for (const track of plan.tracks) {
    if (!Object.hasOwn(EXPECTED, track.id) || trackIds.has(track.id) ||
        !equalMembers(track.requirementIds, EXPECTED[track.id]) ||
        !track.doc?.startsWith('docs/approval-packets/') ||
        !/^docs\/approval-packets\/[a-z0-9-]+[.]md$/.test(track.doc) ||
        !Array.isArray(track.testPaths) || track.testPaths.length < 2 ||
        !Array.isArray(track.gates) || track.gates.length !== 7) {
      throw new Error('Unexpected review track, evidence path, or requirement association.');
    }
    trackIds.add(track.id);
    touched.push(...track.requirementIds);
    await access(resolve(root, track.doc));
    for (const path of track.testPaths) {
      if (!path.startsWith('tests/') || !/^[a-z0-9-]+[.]test[.]mjs$/.test(path.slice(6))) {
        throw new Error('Invalid proof-of-work test path.');
      }
      await access(resolve(root, path));
    }
    for (const gate of track.gates) {
      if (!gate.id?.startsWith(track.id + '-') || gateIds.has(gate.id) ||
          !gate.decision?.trim() || gate.status !== 'pending_human_review' ||
          gate.evidenceReference !== null || gate.approvalReference !== null ||
          !Array.isArray(gate.requiredRoles) || !gate.requiredRoles.length ||
          !gate.requiredRoles.every(role => ALLOWED_ROLES.has(role))) {
        throw new Error('A decision was silently approved, duplicated or lacks human reviewers.');
      }
      gateIds.add(gate.id);
    }
  }
  const remaining = pendingIds.filter(id => !touched.includes(id));
  if (!equalMembers(touched, [...Object.values(EXPECTED).flat()]) ||
      !equalMembers(remaining, plan.otherPendingRequirementIds)) {
    throw new Error('The three tracks must cover their assigned IDs and preserve the rest.');
  }
  const founder = plan.founderDeliberations;
  if (founder?.status !== 'completed_internal_direction' ||
      founder.completedAt !== '2026-11-10' ||
      !equalMembers(founder.gateIds, [...gateIds]) ||
      founder.publicReference !==
        'docs/human-review/FC-GATE-2026-11-09-human-deliberation-board.md' ||
      founder.effect !== 'product_direction_only' ||
      founder.doesNotApproveGates !== true ||
      founder.doesNotAuthorizeProduction !== true) {
    throw new Error('Founder direction must cover all gates without approving operation.');
  }
  await access(resolve(root, founder.publicReference));
  if (gateIds.size !== 21 || plan.reviewProtocol?.length < 40 ||
      matrix.requirements.find(x => x.id === 12)?.status !== 'bloqueado') {
    throw new Error('Missing manual review gates or standby safeguard.');
  }
  return {
    currentPercent: Number((counts.concluido / 70 * 100).toFixed(2)),
    pendingCount: pendingIds.length,
    inThreeTracks: touched.length,
    outsideThreeTracks: remaining.length,
    founderDirectionsRecorded: founder.gateIds.length,
    humanDecisionsPending: gateIds.size,
    approvalsRecorded: 0,
    pilotBH: 'NO-GO',
  };
}

if (isMainModule(import.meta.url)) {
  const [plan, matrix, board] = await Promise.all([
    readFile(new URL('../config/cross-functional-decision-gates.v1.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../docs/requirements-matrix.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../config/codex-action-board.v1.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  console.log(JSON.stringify(await validateCrossFunctionalDecisionGates(plan, matrix, board), null, 2));
}
