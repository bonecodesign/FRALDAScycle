import test from 'node:test';
import assert from 'node:assert/strict';
import { detectProhibitedContent } from '../packages/contracts/content-moderation.js';
test('contacts in digits, words, Unicode and disguised email are detected consistently', () => {
  for (const text of ['(31) 99999-0000','３１ ９９９９９ ００００','3\u200b1 9 9999 0000','trinta e um nove nove nove nove nove zero zero zero zero','nove oito sete seis cinco quatro três dois','fake@example.test','fake [arroba] example [ponto] test','fake ( @ ) example ponto test']) {
    assert.ok(detectProhibitedContent(text).length, text);
  }
});
test('external negotiation invites and chat-specific conditions are blocked', () => {
  for (const text of ['chama no zap','me liga','instagram @ficticio','https://example.test','pix direto']) assert.ok(detectProhibitedContent(text).length,text);
  assert.ok(detectProhibitedContent('contraproposta de preço',{chat:true}).includes('chat_conditions'));
});
test('ordinary quantities, dates and delivery coordination are not rejected by numeric aggregation', () => {
  for (const text of ['Pacote lacrado com 50 unidades.','Tenho três pacotes com quatro unidades.','Validade 10/2027, retirada entre 14 e 16 horas.','Posso preparar o pacote amanhã.']) assert.deepEqual(detectProhibitedContent(text),[],text);
});
test('review-specific privacy signals do not become a general address detector claim', () => {
  assert.ok(detectProhibitedContent('Encontrei na rua Fictícia',{review:true}).includes('private_review_content'));
  assert.ok(detectProhibitedContent('nome do bebê',{review:true}).includes('private_review_content'));
  assert.deepEqual(detectProhibitedContent('Pacote em boas condições',{review:true}),[]);
});
