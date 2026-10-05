import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isMainModule } from '../packages/contracts/main-module.js';

export async function validateRequirements(matrix, root = resolve(import.meta.dirname, '..')) {
  if (matrix.denominator !== 70 || matrix.requirements.length !== 70) throw new Error('A matriz deve conter os 70 itens aprovados, incluindo standby.');
  const counts = { concluido: 0, parcial: 0, pendente: 0, bloqueado: 0 };
  const seen = new Set();
  for (const item of matrix.requirements) {
    if (!Number.isInteger(item.id) || item.id < 1 || item.id > 70 || seen.has(item.id)) throw new Error('Item ausente, duplicado ou fora do registro.');
    seen.add(item.id);
    if (!Object.hasOwn(counts, item.status) || !item.title || !item.reason) throw new Error(`Item ${item.id} inválido.`);
    if (item.status === 'concluido' && (!item.references.length || !item.evidence)) throw new Error(`Item ${item.id} sem evidência.`);
    for (const path of item.references) {
      if (path.startsWith('/') || path.split('/').includes('..')) throw new Error('Referência fora de platform/.');
      await access(resolve(root, path));
    }
    counts[item.status]++;
  }
  if (matrix.requirements.find(item => item.id === 12).status !== 'bloqueado') throw new Error('Item 12 deve permanecer em standby.');
  return { denominator: 70, counts, completedPercent: Number((counts.concluido / 70 * 100).toFixed(2)), productionReadiness: 'bloqueada' };
}

if (isMainModule(import.meta.url)) {
  const matrix = JSON.parse(await readFile(new URL('../docs/requirements-matrix.json', import.meta.url), 'utf8'));
  console.log(JSON.stringify(await validateRequirements(matrix), null, 2));
}
