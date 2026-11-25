import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createPaymentRepository} from '../database/payment-repository.js';
import {createPaymentService} from '../apps/api/payment-service.js';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
const tx='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const row={id,transaction_id:tx,status:'pending',amount_cents:4000,provider_reference:'must-not-leak',checkout_payload:{secret:'must-not-leak'}};
test('FC-412: repository scopes read to buyer, transaction and intent without selecting secret columns',async()=>{
  const calls=[];const repo=createPaymentRepository({async query(sql,args){calls.push({sql,args});return {rows:[row]}}});
  await repo.intentStatus({buyerId:'buyer',transactionId:tx,intentId:id});
  assert.equal(calls.length,1);assert.deepEqual(calls[0].args,[id,tx,'buyer']);
  assert.match(calls[0].sql,/p\.id=\$1 AND p\.transaction_id=\$2 AND p\.buyer_id=\$3 AND t\.buyer_id=\$3/);
  assert.doesNotMatch(calls[0].sql,/checkout_payload|provider_reference|UPDATE|INSERT|DELETE/i);
});
test('FC-412: service exposes only five allowlisted fields and refuses malformed references',async()=>{
  const repo={async intentStatus({buyerId}){return buyerId==='buyer'?row:null}};
  const service=createPaymentService(repo,null);
  assert.deepEqual(await service.intentStatus('buyer',tx,id),{payment:{id,transactionId:tx,status:'pending',amountCents:4000,currency:'BRL'}});
  await assert.rejects(service.intentStatus('other',tx,id),e=>e.status===404);
  await assert.rejects(service.intentStatus('buyer',tx,'invalid'),e=>e.status===422);
  await assert.rejects(createPaymentService({async intentStatus(){return {...row,status:'unknown'}}},null).intentStatus('buyer',tx,id),e=>e.status===503);
});
test('FC-412: HTTP status requires a session; wrong buyer is indistinguishable from missing intent',async t=>{
  const service=createPaymentService({async intentStatus({buyerId,transactionId,intentId}){return buyerId==='buyer'&&transactionId===tx&&intentId===id?row:null}},null);
  const server=createApiServer({config:loadConfig({NODE_ENV:'test'}),authService:{async session(token){return ['buyer','other'].includes(token)?{id:token}:null}},paymentService:service});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());
  const url='http://127.0.0.1:'+server.address().port+'/v1/transactions/'+tx+'/payments/'+id+'/status';
  assert.equal((await fetch(url)).status,401);
  assert.equal((await fetch(url,{headers:{cookie:'fc_session=other'}})).status,404);
  const ok=await fetch(url,{headers:{cookie:'fc_session=buyer'}});
  assert.equal(ok.status,200);assert.equal(ok.headers.get('cache-control'),'no-store');
  assert.equal((await ok.json()).payment.status,'pending');
});
const source=(await readFile(new URL('../apps/app/finance.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'').split('\nsetupPaymentFlow();')[0];
function browser(send,initialId=id){
  const node=()=>({textContent:'',disabled:false,attributes:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this[k]=fn}});
  const panel=node(),message=node(),amount=node(),refresh=node(),calls=[];
  const nodes={'payment-success-content':panel,'payment-status-message':message,'payment-status-amount':amount,'payment-status-refresh':refresh};
  const ctx=vm.createContext({Intl,document:{getElementById:k=>nodes[k]},sessionStorage:{getItem:k=>k==='fc.activeTransactionId'?tx:initialId},apiRequest:async(path)=>{calls.push(path);return send()}});
  vm.runInContext(source,ctx);return{ctx,panel,message,amount,refresh,calls};
}
test('FC-412: only paid server state shows a confirmed amount; refresh clears stale confirmation',async()=>{
  let status='paid';const h=browser(async()=>({payment:{id,transactionId:tx,status,amountCents:4000,currency:'BRL'}}));
  await h.ctx.setupPaymentStatus();assert.match(h.amount.textContent,/40,00/);
  for(const value of ['pending','authorized','provider_pending','failed','cancelled','refunded','disputed','unknown']){
    status=value;await h.refresh.click();assert.equal(h.amount.textContent,'');
  }
  assert.equal(h.refresh.disabled,false);
});
test('FC-412: no identity or mismatched response cannot display a paid amount',async()=>{
  const h=browser(async()=>({payment:{id:'wrong',transactionId:tx,status:'paid',amountCents:4000,currency:'BRL'}}));
  await h.ctx.setupPaymentStatus();assert.equal(h.amount.textContent,'');assert.match(h.message.textContent,/Não foi possível/);
  const missing=browser(()=>{throw Error('must not call')},null);await missing.ctx.setupPaymentStatus();assert.equal(missing.calls.length,0);
});
