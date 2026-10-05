import assert from 'node:assert/strict';
import test from 'node:test';
import {createReviewModerationService} from '../apps/api/review-moderation-service.js';
test('review risk report binds identity and requires confirmed category without private payload extensions',()=>{
  const service=createReviewModerationService({report(v){return v;}}),input={category:'privacy',details:'Possível informação privada na avaliação fictícia.',confirmed:true};
  assert.throws(()=>service.report({id:'owner'},'review',{...input,reporterId:'foreign'}),e=>e.status===422);
  assert.throws(()=>service.report({id:'owner'},'review',{...input,confirmed:false}),e=>e.status===422);
  assert.equal(service.report({id:'owner'},'review',input).actorId,'owner');
});
test('review moderation scope and version cannot be forged by customer',()=>{
  const service=createReviewModerationService({decide(v){return v;},appeal(v){return v;}}),input={outcome:'removed',reason:'Análise fictícia da avaliação.',expectedVersion:1,confirmed:true};
  assert.throws(()=>service.decide({id:'owner',role:'customer'},'review',input),e=>e.status===403);
  assert.throws(()=>service.decide({id:'admin',role:'admin'},'review',{...input,expectedVersion:-1}),e=>e.status===422);
  assert.equal(service.decide({id:'mod',role:'moderator'},'review',input).actorId,'mod');
  assert.equal(service.appeal({id:'owner'},'review',{details:input.reason,expectedVersion:1,confirmed:true}).actorId,'owner');
});
