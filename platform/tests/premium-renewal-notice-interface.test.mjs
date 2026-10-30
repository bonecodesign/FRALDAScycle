import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('premium interface presents the durable renewal failure notice without promising billing or retries',async()=>{
  const [html,script]=await Promise.all([
    readFile(new URL('../apps/app/premium.html',import.meta.url),'utf8'),
    readFile(new URL('../apps/app/premium.js',import.meta.url),'utf8'),
  ]);
  assert.match(html,/id="premium-renewal-notice" role="alert" hidden/);
  assert.match(script,/premium\.renewalFailureNotice\.regularizeBy/);
  assert.match(script,/Os benefícios permanecem ativos até esse prazo/);
  assert.match(script,/Não há cobrança ou retentativa automática nesta versão/);
  assert.match(script,/Regularizar com outro cartão/);
});

test('initial payment failure is shown only inside Premium and offers manual retry',async()=>{
  const [html,script,repository]=await Promise.all([
    readFile(new URL('../apps/app/premium.html',import.meta.url),'utf8'),
    readFile(new URL('../apps/app/premium.js',import.meta.url),'utf8'),
    readFile(new URL('../database/premium-repository.js',import.meta.url),'utf8'),
  ]);
  assert.match(html,/id="premium-payment-notice" role="alert" hidden/);
  assert.match(script,/premium\.initialPaymentNotice/);
  assert.match(repository,/initial_payment_failed/);
  assert.match(repository,/tente novamente com um cartão tokenizado/);
  assert.doesNotMatch(repository,/notification_outbox|recipient|channel.*email/i);
});
