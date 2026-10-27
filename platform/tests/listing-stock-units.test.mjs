import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const migration=await readFile(new URL('../database/migrations/078_listing_stock_units.sql',import.meta.url),'utf8');
const repository=await readFile(new URL('../database/marketplace-repository.js',import.meta.url),'utf8');
const service=await readFile(new URL('../apps/api/marketplace-service.js',import.meta.url),'utf8');
const app=await readFile(new URL('../apps/app/listing.js',import.meta.url),'utf8');
const publish=await readFile(new URL('../apps/app/publish.js',import.meta.url),'utf8');
const support=await readFile(new URL('../database/operation-support-repository.js',import.meta.url),'utf8');

test('one listing stores plan-bounded identical product units separately from diapers per package',()=>{
  assert.match(migration,/stock_units smallint NOT NULL DEFAULT 1/);
  assert.match(migration,/stock_units BETWEEN 1 AND 5/);
  assert.match(migration,/item_units BETWEEN 1 AND 5/);
  assert.match(service,/invalid_stock_units/);
  assert.match(publish,/Pacotes iguais neste anúncio/);
  assert.match(publish,/Fraldas por pacote/);
  assert.match(repository,/benefitsActive\?5:3/);
  assert.match(repository,/listing_stock_plan_limit/);
});

test('purchase locks the listing, totals selected units and closes only exhausted stock',()=>{
  assert.match(repository,/status='published' AND kind='sale'[\s\S]*FOR UPDATE/);
  assert.match(repository,/sum\(item_units\)[\s\S]*status<>'cancelled'/);
  assert.match(repository,/price_cents\*itemUnits/);
  assert.match(repository,/committed\+itemUnits===listing\.stock_units/);
  assert.match(repository,/status='unavailable'/);
  assert.match(app,/body: \{ itemUnits \}/);
  assert.match(app,/available_units\?\?listing\.stock_units/);
});

test('cancellation can reopen only an announcement that has remaining stock',()=>{
  assert.match(support,/stock_units>COALESCE\(sum\(t\.item_units\)/);
  assert.match(support,/FILTER\(WHERE t\.status<>'cancelled'\)/);
  assert.match(support,/if\(hasStock\).*status=\$2::listing_status/);
});
