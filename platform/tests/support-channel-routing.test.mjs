import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

test('support entry in the app does not redirect to the payment-gated negotiation chat', async () => {
  const page = await readFile(new URL('../apps/app/help.html', import.meta.url), 'utf8');
  assert.match(page, /href="#support-heading"[^>]*>[\s\S]*?<strong>Conversa com o suporte<\/strong>/);
  assert.match(page, /Abra um protocolo e envie novas mensagens à equipe por aqui./);
  assert.doesNotMatch(page, /href="\/app\/chat"[^>]*>[\s\S]*?<strong>Chat online<\/strong>/);
  assert.match(page, /Domínio próprio do FraldaCycle em definição/);
  assert.match(page, /data-action="support-email" disabled/);
});
