import test from "node:test";
import assert from "node:assert/strict";
import { renderAppSearch } from "../packages/contracts/marketplace-ui.js";

function deferred() {
  let resolve, reject;
  const promise = new Promise((a,b) => { resolve=a; reject=b; });
  return {promise,resolve,reject};
}
function element(value="") {
  const handlers=new Map();
  return {value,disabled:false,textContent:"Buscar anúncios",innerHTML:"",attrs:{},focused:false,
    addEventListener(name,fn){handlers.set(name,fn);},
    setAttribute(name,v){this.attrs[name]=v;},
    querySelectorAll(){return [];},
    focus(){this.focused=true;},
    fire(name="click"){return handlers.get(name)?.({stopImmediatePropagation(){}});}
  };
}
async function fixture(search,coordinates=async()=>null) {
  const input=element("original"),type=element("Venda"),size=element("M"),button=element(),reset=element(),results=element();
  const elements={"#app-search-input":input,"#app-search-submit":button,"#app-filter-reset":reset,"#app-search-results":results,"#app-filter-type":type,"#app-filter-size":size};
  await renderAppSearch({root:{querySelector:s=>elements[s]},search,coordinates});
  return {input,type,size,button,reset,results};
}
const response = name => ({items:[{}],markup:name});
const tick = () => new Promise(resolve=>setImmediate(resolve));

test("reset discards old success and keeps the new search busy", async()=>{
  const old=deferred(),fresh=deferred();let calls=0;
  const f=await fixture(()=> (++calls===1?old:fresh).promise);
  const first=f.button.fire();await tick();
  f.reset.fire();assert.equal(f.input.focused,true);assert.equal(f.button.disabled,false);
  assert.equal(f.input.value,"");assert.equal(f.type.value,"");assert.equal(f.size.value,"");
  f.input.value="new";const second=f.button.fire();await tick();
  old.resolve(response("OLD"));await first;
  assert.equal(f.button.disabled,true);assert.equal(f.results.attrs["aria-busy"],"true");
  assert.doesNotMatch(f.results.innerHTML,/OLD/);
  fresh.resolve(response("NEW"));await second;
  assert.match(f.results.innerHTML,/NEW/);assert.equal(f.button.disabled,false);assert.equal(f.results.attrs["aria-busy"],"false");
});

test("reset discards old failure and preserves cleared state",async()=>{
  const old=deferred();const f=await fixture(()=>old.promise);
  const first=f.button.fire();await tick();f.reset.fire();old.reject(new Error("OLD"));await first;
  assert.match(f.results.innerHTML,/Faça uma busca/);assert.equal(f.button.textContent,"Buscar anúncios");
  assert.equal(f.results.attrs["aria-busy"],"false");assert.equal(f.button.disabled,false);
});

test("reset before geolocation avoids obsolete API request",async()=>{
  const geo=deferred();let calls=0;const f=await fixture(async()=>{calls++;return response("OLD");},()=>geo.promise);
  const pending=f.button.fire();f.reset.fire();geo.resolve(null);await pending;
  assert.equal(calls,0);assert.match(f.results.innerHTML,/Faça uma busca/);
});

test("filters are captured when the user starts the search",async()=>{
  const geo=deferred();let filters;const f=await fixture(async value=>{filters=value;return response("OK");},()=>geo.promise);
  const pending=f.button.fire();f.input.value="edited";f.type.value="Troca";f.size.value="G";geo.resolve(null);await pending;
  assert.deepEqual(filters,{surface:"app",query:"original",kind:"Venda",size:"M"});
  assert.match(f.results.innerHTML,/OK/);
});

test("duplicate click while busy does not start another request",async()=>{
  const old=deferred();let calls=0;const f=await fixture(()=>{calls++;return old.promise;});
  const first=f.button.fire();await tick();await f.button.fire();assert.equal(calls,1);
  old.resolve({items:[],markup:""});await first;assert.match(f.results.innerHTML,/Nenhum item encontrado/);
});
