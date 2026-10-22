import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

test('support page publishes the approved hours and distinguishes first response from resolution', async()=>{
  const page=await readFile(new URL('../apps/app/help.html',import.meta.url),'utf8');
  assert.match(page,/Atendimento interno: segunda a sexta, das 9h às 18h \(horário de Brasília\)/);
  assert.match(page,/Primeira resposta em até 2 dias úteis/);
  assert.match(page,/registro e acompanhamento do pedido ficam disponíveis a qualquer momento/);
  assert.match(page,/não representa garantia de resolução/);
  assert.doesNotMatch(page,/Horários e prazos de atendimento serão definidos antes do piloto/);
});
