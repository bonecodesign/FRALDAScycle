import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

test('admin work queue explains sector isolation and avoids financial execution controls',async()=>{
 const html=await readFile(new URL('../apps/admin/work-items.html',import.meta.url),'utf8');
 const script=await readFile(new URL('../apps/admin/work-items.js',import.meta.url),'utf8');
 assert.match(html,/Outros setores compartilham somente o andamento/);
 assert.match(html,/Anexos não são aceitos entre setores/);
 assert.match(script,/detalhes protegidos/);
 assert.match(script,/\/v1\/admin\/work-items/);
 assert.doesNotMatch(`${html}\n${script}`,/executar pagamento|confirmar reembolso|paymentProvider/);
});
