import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');

test('listing approval starts one immutable thirty-day publication cycle', async()=>{
  const source=await readFile(resolve(root,'database/admin-repository.js'),'utf8');
  assert.match(source,/expires_at=CASE WHEN \$2='published' THEN now\(\)\+interval '30 days'/);
  assert.match(source,/pause_reason=NULL/);
});

test('price-adjustment pause still occupies a free-plan slot until expiry', async()=>{
  const source=await readFile(resolve(root,'database/premium-repository.js'),'utf8');
  assert.match(source,/status='paused' AND pause_reason='price_adjustment_required'/);
  assert.match(source,/expires_at IS NULL OR expires_at>now\(\)/);
});
