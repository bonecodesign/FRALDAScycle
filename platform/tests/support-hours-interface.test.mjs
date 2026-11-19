import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

test('support page publishes the approved hours and distinguishes first response from resolution', async()=>{
  const page=await readFile(new URL('../apps/app/help.html',import.meta.url),'utf8');
  assert.match(page,/Atendimento interno: segunda a sexta, das 9h às 18h \(horário de Brasília\)/);
  assert.match(page,/crítico em até 30 minutos, alto em até 4 horas, normal em até 1 dia útil e baixo em até 2 dias úteis/);
  assert.match(page,/registro e acompanhamento ficam disponíveis a qualquer momento/);
  assert.match(page,/não representam garantia de resolução/);
  assert.match(page,/atendimento por equipe real ainda depende de homologação/);
  assert.doesNotMatch(page,/Horários e prazos de atendimento serão definidos antes do piloto/);
});
