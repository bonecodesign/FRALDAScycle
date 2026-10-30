import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
test('level 3 refund UI confirms exact amount and uses a fresh purpose-bound step-up',async()=>{
  const [html,source]=await Promise.all([read('apps/admin/operations.html'),read('apps/admin/supported-refund.js')]);
  assert.match(html,/id="supported-refund-execution"/);assert.match(html,/Confirmo o valor/);assert.match(html,/depende do webhook/);
  assert.match(html,/id="supported-refund-filter"/);assert.match(html,/id="supported-refund-review"/);assert.match(html,/Acompanhar com o provedor/);assert.match(html,/Retornar para reanálise do suporte/);
  assert.match(source,/purpose:'refund_execution'/);assert.match(source,/crypto\.randomUUID\(\)/);assert.match(source,/refund\.refundAmountCents/);
  assert.match(source,/\/history/);assert.match(source,/\/reviews/);assert.match(source,/sem movimentação financeira/i);assert.match(source,/aguardando confirmação do provedor/i);assert.doesNotMatch(source,/localStorage|sessionStorage/);
});
