import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=(await readFile(new URL('../apps/app/listing.js',import.meta.url),'utf8'))
  .replace(/^import .*;\s*$/gm,'').replace(/void loadListing\(\);\s*$/,'');
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.handlers={};this.value='1';this.disabled=false}
  append(...nodes){this.children.push(...nodes)}
  replaceChildren(...nodes){this.children=nodes}
  setAttribute(k,v){this.attributes[k]=v}
  addEventListener(k,v){this.handlers[k]=v}
}
const fixture={id:'listing-1',kind:'sale',status:'published',title:'Fraldas M',package_condition:'sealed',quantity:24,stock_units:3,available_units:2};
async function harness(patch={},send=async()=>({transaction:{id:'transaction-1',status:'initiated'}})){
  const target=new Element('section'),calls=[],navigation=[],storage=new Map();
  const listing={...fixture,...patch};
  const context=vm.createContext({
    URL,location:{href:'https://example.test/app/listing?id=listing-1'},
    document:{getElementById:()=>target,createElement:tag=>new Element(tag)},
    money:()=> 'R$ 40,00',
    apiRequest:async(path,options)=>{if(!options)return {listing};calls.push({path,options});return send()},
    sessionStorage:{setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    window:{location:{assign:path=>navigation.push(path)}},
  });
  vm.runInContext(source,context);await context.loadListing();
  const article=target.children[0],button=article.children.find(x=>x.tag==='button');
  const select=article.children.flatMap(x=>x.children).find(x=>x.tag==='select');
  const feedback=article.children.at(-1);
  return {context,listing,article,button,select,feedback,calls,navigation,storage};
}
test('FC-407: zero, invalid or missing stock never renders a purchase or exchange action',async()=>{
  for(const patch of [{available_units:0},{available_units:-1},{available_units:1.5},{available_units:6},{available_units:Infinity},{available_units:'2'},{available_units:undefined,stock_units:undefined},{kind:'exchange',available_units:0}]){
    const h=await harness(patch);
    assert.equal(h.button,undefined);
    assert.equal(h.article.children.some(x=>x.tag==='a'),false);
    assert.ok(h.article.children.some(x=>x.textContent?.includes('não está disponível')));
    assert.equal(h.calls.length,0);
  }
});
test('FC-407: authoritative available count, legacy numeric fallback and accessible feedback',async()=>{
  for(const [patch,n] of [[{},2],[{available_units:undefined},3],[{available_units:5,stock_units:5},5]]){
    const h=await harness(patch);
    assert.ok(h.button);assert.equal(h.select.children.length,n);
    assert.equal(h.feedback.attributes.role,'status');assert.equal(h.feedback.attributes['aria-live'],'polite');
  }
});
test('FC-407: invalid quantities cannot issue a transaction request',async()=>{
  const h=await harness();
  for(const count of [0,-1,1.5,3,Infinity,NaN,'1'])await h.context.beginPurchase(h.listing,count,h.button,h.feedback);
  assert.equal(h.calls.length,0);assert.match(h.feedback.textContent,/Quantidade indisponível/);
});
test('FC-407: concurrent activation sends one transaction and only confirmed result navigates',async()=>{
  let release;const h=await harness({},()=>new Promise(resolve=>{release=resolve}));
  const pending=h.context.beginPurchase(h.listing,2,h.button,h.feedback);
  await h.context.beginPurchase(h.listing,2,h.button,h.feedback);
  assert.equal(h.calls.length,1);assert.equal(h.navigation.length,0);
  assert.equal(h.calls[0].options.body.itemUnits,2);
  release({transaction:{id:'transaction-1',status:'initiated'}});await pending;
  assert.deepEqual(h.navigation,['/app/payment']);assert.equal(h.storage.get('fc.activeTransactionId'),'transaction-1');
});
test('FC-407: rejected transaction allows retry without navigating or inventing a transaction',async()=>{
  const h=await harness({},async()=>{throw Error('Estoque alterado')});
  await h.context.beginPurchase(h.listing,2,h.button,h.feedback);
  assert.equal(h.button.disabled,false);assert.equal(h.navigation.length,0);assert.equal(h.storage.size,0);
  assert.equal(h.feedback.textContent,'Estoque alterado');
});
