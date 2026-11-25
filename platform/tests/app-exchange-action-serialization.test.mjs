import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../apps/app/exchange.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'');
const field=(value='',checked=false)=>({value,checked,disabled:false});
const node=()=>({disabled:false,textContent:'',attributes:{},handlers:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,v){this.handlers[k]=v}});
function harness(send){
  const status=node(),load=node(),refuse=node(),cancel=node(),accept=node(),submit=node();
  const offered=field('own');offered.options=[];offered.replaceChildren=(...options)=>{offered.options=options};offered.add=o=>offered.options.push(o);
  const propose=Object.assign(node(),{elements:{requestedListingId:field('wanted'),offeredListingId:offered,requesterDeclaredValue:field('20'),confirmed:field('',true)},querySelectorAll:()=>[submit]});
  const manage=Object.assign(node(),{elements:{transactionId:field('tx-1'),expectedVersion:field('1'),ownerDeclaredValue:field('20'),reason:field('Motivo de teste'),confirmed:field('',true)},querySelectorAll:()=>[load,accept,refuse,cancel],querySelector:()=>({insertAdjacentHTML(){}})});
  const nodes={'exchange-propose':propose,'exchange-manage':manage,'exchange-status':status,'exchange-load':load,'exchange-refuse':refuse,'exchange-cancel':cancel};
  const calls=[],storage=new Map();
  const ctx=vm.createContext({URL,Intl,Option:function(label,value){this.label=label;this.value=value},location:{href:'https://example.test/app/exchange'},document:{getElementById:id=>nodes[id]},apiRequest:async(path,options)=>{if(path==='/v1/account/listings')return {items:[{id:'own',kind:'exchange',status:'published',title:'Fraldas'}]};calls.push({path,options});return send(path,options)},parsePrice:()=>2000,sessionStorage:{setItem:(k,v)=>storage.set(k,v)}});
  vm.runInContext(source,ctx);
  return {status,load,refuse,cancel,accept,submit,propose,manage,calls,storage};
}
const response=(version=2,id='tx-1')=>({exchange:{transaction_id:id,version,status:'proposed'}});
const evt={preventDefault(){}};
test('FC-408: duplicate and competing actions during a pending request are ignored',async()=>{
  let resolve;const h=harness(()=>new Promise(r=>{resolve=r}));
  const pending=h.propose.handlers.submit(evt);
  await h.propose.handlers.submit(evt);await h.load.handlers.click();await h.cancel.handlers.click();
  assert.equal(h.calls.length,1);assert.equal(h.status.attributes['aria-busy'],'true');
  assert.equal(h.accept.disabled,true);assert.equal(h.manage.elements.transactionId.disabled,true);
  resolve(response());await pending;
  assert.equal(h.status.attributes['aria-busy'],'false');assert.equal(h.accept.disabled,false);
  assert.equal(h.manage.elements.expectedVersion.value,'2');assert.equal(h.manage.elements.confirmed.checked,false);assert.equal(h.propose.elements.confirmed.checked,false);
});
test('FC-408: consultation synchronizes the server version used by subsequent decisions',async()=>{
  const h=harness((path)=>Promise.resolve(response(path.endsWith('/accept')?4:3)));
  await h.load.handlers.click();assert.equal(h.manage.elements.expectedVersion.value,'3');
  h.manage.elements.confirmed.checked=true;
  await h.manage.handlers.submit(evt);
  assert.equal(h.calls[1].options.body.expectedVersion,3);
  assert.equal(h.calls[1].options.body.confirmed,true);
  assert.equal(h.manage.elements.expectedVersion.value,'4');assert.equal(h.manage.elements.confirmed.checked,false);
});
test('FC-408: mismatched or malformed response cannot update local transaction state',async()=>{
  for(const result of [response(2,'wrong'),response(0),response('2'),{exchange:null}]){
    const h=harness(()=>Promise.resolve(result));await h.load.handlers.click();
    assert.equal(h.storage.size,0);assert.equal(h.manage.elements.expectedVersion.value,'1');
    assert.match(h.status.textContent,/Resposta da operação inválida/);assert.equal(h.load.disabled,false);
  }
});
test('FC-408: failed request releases guard and preserves already disabled controls',async()=>{
  const h=harness(()=>Promise.reject(Error('Conflito de versão')));h.refuse.disabled=true;
  await h.load.handlers.click();assert.equal(h.status.textContent,'Conflito de versão');
  assert.equal(h.refuse.disabled,true);assert.equal(h.load.disabled,false);assert.equal(h.status.attributes['aria-busy'],'false');
  await h.load.handlers.click();assert.equal(h.calls.length,2);
});
