import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('design system exposes the normative typography, geometry, motion and accessibility tokens', async () => {
  const tokens = await read('../packages/ui/tokens.css');
  for (const contract of [
    '--fc-font-interface: Inter',
    '--fc-font-display: Poppins',
    '--fc-space-1: 4px',
    '--fc-radius-md: 8px',
    '--fc-shadow-md:',
    '--fc-focus-ring:',
    '--fc-target-min: 44px',
    '--fc-motion-fast: 150ms',
    '--fc-motion-slow: 300ms',
    'prefers-reduced-motion: reduce',
  ]) assert.match(tokens, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('visual conformity matrix covers every normative requirement and the complete board range', async () => {
  const matrix = await read('../docs/visual-fidelity/MATRIZ_CONFORMIDADE_VISUAL.md');
  for (const prefix of ['DS-01', 'DS-05', 'ST-01', 'ST-05', 'AP-01', 'AP-08', 'AD-01', 'AD-06', 'RG-01', 'RG-02']) {
    assert.match(matrix, new RegExp(`\\| ${prefix} \\|`));
  }
  assert.match(matrix, /Page6\.png` a `FraldaCycle_Acervopng_Page68\.png/);
});
