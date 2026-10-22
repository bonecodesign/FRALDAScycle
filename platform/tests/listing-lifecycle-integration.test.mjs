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


test('price adjustment reactivation preserves the original lifecycle dates', () => {
  const pricing = readFileSync(new URL('../database/monthly-pricing-repository.js', import.meta.url), 'utf8');
  assert.match(pricing, /price_cents=\$3,status='published',pause_reason=NULL,updated_at=now\(\)/);
  assert.doesNotMatch(pricing, /price_cents=\$3,status='published',pause_reason=NULL,published_at=/);
  assert.doesNotMatch(pricing, /price_cents=\$3,status='published',pause_reason=NULL[^\n]*expires_at=/);
  assert.match(pricing, /listing_price_above_ceiling/);
  assert.match(pricing, /listing_expired/);
});

test('generic publication cannot bypass a mandatory price adjustment', () => {
  const premium = readFileSync(new URL('../database/premium-repository.js', import.meta.url), 'utf8');
  assert.match(premium, /pause_reason === 'price_adjustment_required'/);
  assert.match(premium, /listing_price_adjustment_required/);
});

test('resubmission clears the previous publication lifecycle', () => {
  const marketplace = readFileSync(new URL('../database/marketplace-repository.js', import.meta.url), 'utf8');
  assert.match(marketplace, /published_at=NULL,expires_at=NULL,pause_reason=NULL/);
});
