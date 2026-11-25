import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const source=(await read('../apps/app/finance.js')).replace(/^import .*;\s*$/gm,'').split('\nsetupPaymentFlow();')[0];
const tx='11111111-1111-4111-8111-111111111111';
const valid={transactionId:tx,currency:'BRL',totalCents:4000,product:{amountCents:4000},wallet:{availableCents:0,usableByThisAccount:false}};
function harness(preview,send=async()=>({intent:{id:'intent-1',transactionId:tx,status:'pending'}}),transactionId=tx){
  const node=()=>({disabled:false,textContent:'',dataset:{},addEventListener(name,fn){this[name]=fn},querySelector(){return null}});
  const submit=node();submit.dataset.method='pix';
  const detail=node(),error=node(),wallet=node(),pix=node(),credit=node();wallet.disabled=true;
  const options=[pix,credit,wallet];
  const nodes={'payment-submit':submit,'payment-method-detail':detail,'payment-error':error,'payment-product-value':node(),'payment-freight-row':node(),'payment-total-value':node(),'payment-wallet-label':node()};
  const calls=[],navigation=[],storage=new Map();if(transactionId)storage.set('fc.activeTransactionId',transactionId);
  const context=vm.createContext({Intl,Number,Event:class{},crypto:{randomUUID:()=> 'synthetic-idempotency-key'},document:{getElementById:id=>nodes[id]??null,querySelectorAll:()=>options,querySelector:()=>wallet},window:{dispatchEvent(){},location:{assign:p=>navigation.push(p)}},sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},apiRequest:async(path,opts)=>{if(path.endsWith('/payment-breakdown')){if(preview instanceof Error)throw preview;return preview}calls.push({path,opts});return send()}});
  vm.runInContext(source,context);
  return {context,submit,error,options,calls,navigation,storage};
}
const event={preventDefault(){},stopImmediatePropagation(){}};
test('FC-410: no preview or an invalid preview cannot initiate payment',async()=>{
  for(const preview of [new Error('offline'),null,{...valid,transactionId:'other'},{...valid,totalCents:0},{...valid,wallet:null}]){
    const h=harness(preview);await h.context.setupRealPayments();assert.equal(h.submit.disabled,true);
    await h.submit.click(event);assert.equal(h.calls.length,0);
  }
});
test('FC-410: concurrent activation is ignored; payment method controls remain locked during request',async()=>{
  let release;const h=harness(valid,()=>new Promise(r=>{release=r}));await h.context.setupRealPayments();
  const pending=h.submit.click(event);await h.submit.click(event);
  assert.equal(h.calls.length,1);assert.ok(h.options.every(o=>o.disabled));assert.equal(h.navigation.length,0);
  release({intent:{id:'intent-1',transactionId:tx,status:'pending'}});await pending;
  assert.deepEqual(h.navigation,['/app/payment-success']);assert.equal(h.storage.get('fc.paymentIntentId'),'intent-1');assert.equal(h.storage.has('fc.paymentConfirmed'),false);
});
test('FC-410: incorrect intent response cannot redirect and failure restores original controls',async()=>{
  const h=harness(valid,async()=>({intent:{id:'wrong',transactionId:'other'}}));await h.context.setupRealPayments();
  await h.submit.click(event);assert.equal(h.navigation.length,0);assert.equal(h.submit.disabled,false);assert.deepEqual(h.options.map(o=>o.disabled),[false,false,true]);
  assert.match(h.error.textContent,/Resposta do pagamento inválida/);assert.equal(h.storage.has('fc.paymentIntentId'),false);
});
test('FC-410: result route and initial checkout cannot imply settlement',async()=>{
  const [result,checkout]=await Promise.all([read('../apps/app/payment-success.html'),read('../apps/app/payment.html')]);
  assert.doesNotMatch(result,/Pagamento aprovado|R\$ 51,00|PIX-2387-9841-1123|Valor pago/);
  assert.match(result,/Confirmação do pagamento/);
  assert.match(result,/id="receipt-submit" disabled/);assert.match(checkout,/id="payment-submit" disabled/);
  assert.doesNotMatch(source,/setItem\([^\n]*fc\.paymentConfirmed/);
});
