import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const load=step=>readFile(new URL(`../apps/app/publish-${step}.html`,import.meta.url),'utf8');

test('all eight publication stages expose keyboard reachable skip links and named main landmarks',async()=>{
  for(let step=1;step<=8;step++){
    const html=await load(step);
    assert.match(html,/<a class="skip-link" href="#main">Pular para o conteúdo<\/a>/);
    assert.match(html,/<main id="main" tabindex="-1"/);
    assert.match(html,new RegExp(`data-publish-step="${step}"`));
    assert.match(html,/class="field-error publish-error" role="alert"/);
    assert.match(html,/href="\/app\/publish-1"[^>]*>.*?Publicar/s);
    if(step<8)assert.match(html,/<button[^>]+id="publish-next"[^>]+type="button"/);
    else assert.match(html,/<button[^>]+id="publish-submit"/);
  }
});

test('every editable publication field has an explicit matching accessible label',async()=>{
  const expected={2:['app-diaper-category','app-diaper-model','app-diaper-size','app-diaper-quantity'],4:['publish-expiry','publish-description'],5:['publish-price'],7:['publish-postcode','publish-neighborhood']};
  for(const [step,fields] of Object.entries(expected)){
    const html=await load(Number(step));
    const labels=[...html.matchAll(/<label for="([^"]+)">([^<]+)<\/label>/g)];
    for(const id of fields){
      const label=labels.find(match=>match[1]===id);
      assert.ok(label,`missing label for ${id} in stage ${step}`);
      assert.ok(new RegExp(`<(?:select|input|textarea)\\b[^>]*\\bid="${id}"`).test(html),`missing control ${id} in stage ${step}`);
    }
    assert.doesNotMatch(html,/<div class="form-group"><label(?![^>]*\bfor=)/);
  }
});

test('seller price begins empty, supports decimal keyboard and is explained',async()=>{
  const html=await load(5);
  assert.match(html,/<input id="publish-price"[^>]*inputmode="decimal"/);
  assert.match(html,/aria-describedby="publish-price-help"/);
  assert.match(html,/id="publish-price-help"/);
  assert.doesNotMatch(html,/<input[^>]*class="input proposal-value"[^>]*\bvalue=/);
});
