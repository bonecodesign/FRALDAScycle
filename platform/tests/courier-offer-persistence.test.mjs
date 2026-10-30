import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('courier candidate persistence keeps ranking without storing coordinates',async()=>{
  const migration=await readFile(new URL('../database/migrations/095_delivery_quote_courier_candidates.sql',import.meta.url),'utf8');
  assert.match(migration,/priority integer/);assert.match(migration,/distance_to_recipient_km/);
  assert.doesNotMatch(migration,/latitude|longitude/);
});

test('offer activation requires paid locked quote and advances one candidate at a time',async()=>{
  const source=await readFile(new URL('../database/delivery-quote-repository.js',import.meta.url),'utf8');
  assert.match(source,/q\.status='locked'/);assert.match(source,/p\.status='paid'/);
  assert.match(source,/now\(\)\+interval '3 minutes'/);
  assert.match(source,/status='expired'/);assert.match(source,/fallback:'loggi_express'/);
  assert.match(source,/NOT EXISTS\(SELECT 1 FROM courier_delivery_offers/);
});
