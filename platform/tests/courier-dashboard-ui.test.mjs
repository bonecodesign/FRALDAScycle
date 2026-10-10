import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const id='11111111-1111-4111-8111-111111111111';
function element(){return {children:[],disabled:false,handlers:{},append(...nodes){this.children.push(...nodes)},replaceChildren(){this.children=[]},addEventListener(type,fn){this.handlers[type]=fn},querySelectorAll(){return this.children.flatMap(panel=>panel.children.filter(node=>node.type==='button'))}}}
async function harness(apiRequest,history=false,timeoutSignal=null){
 const source=(await readFile(new URL('../apps/app/courier-dashboard.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'');
 const list=element(),refresh=element(),feedback=element(),values=new Map(),navigations=[];
 vm.runInNewContext(source,{AbortSignal:timeoutSignal?{timeout:()=>timeoutSignal}:AbortSignal,document:{getElementById:key=>({'courier-deliveries':history?null:list,'courier-history-records':history?list:null,'courier-feedback':feedback,'courier-refresh':refresh})[key],createElement:()=>element()},apiRequest,sessionStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},window:{location:{assign:path=>navigations.push(path)}}});
 await new Promise(resolve=>setImmediate(resolve));return {list,refresh,feedback,values,navigations,select:()=>list.querySelectorAll()[0].handlers.click()};
}
test('dashboard rechecks assignment, blocks duplicate selection and uses refreshed state',async()=>{
 let calls=0,finish;const app=await harness(async()=>++calls===1?{items:[{id,status:'assigned'}]}:new Promise(resolve=>finish=resolve));
 app.values.set('fc.deliveryProofShipmentId','old');app.values.set('fc.deliveryProofMediaKey','old-photo');const pending=app.select();await app.select();assert.equal(calls,2);assert.equal(app.refresh.disabled,true);finish({items:[{id,status:'picked_up'}]});await pending;
 assert.equal(app.values.get('fc.activeShipmentId'),id);assert.equal(app.values.has('fc.deliveryProofMediaKey'),false);assert.deepEqual(app.navigations,['/courier/proof']);
});
test('revoked assignment does not select shipment or erase saved photo',async()=>{
 let calls=0;const app=await harness(async()=>({items:++calls===1?[{id,status:'assigned'}]:[]}));app.values.set('fc.activeShipmentId','previous');app.values.set('fc.deliveryProofMediaKey','old-photo');await app.select();assert.equal(app.values.get('fc.activeShipmentId'),'previous');assert.equal(app.values.get('fc.deliveryProofMediaKey'),'old-photo');assert.equal(app.navigations.length,0);assert.equal(app.refresh.disabled,false);
});
test('dashboard handles empty and malformed responses without selectable cards',async()=>{
 for(const response of [{items:[]},{items:[{id:'invalid',status:'assigned'}]},{}]){const app=await harness(async()=>response);assert.equal(app.list.children.length,0);assert.equal(app.refresh.disabled,false);assert.ok(app.feedback.textContent);}
 const failed=await harness(async()=>{throw new Error('Sessão expirada')});assert.equal(failed.list.children.length,0);assert.equal(failed.feedback.textContent,'Sessão expirada');
});

 test('history is read-only and preserves the active shipment and its proof',async()=>{
   const app=await harness(async(path)=>{assert.equal(path,'/v1/courier/history');return {items:[{id,status:'delivered'},{id,status:'failed'},{id,status:'cancelled'}]}},true);
   app.values.set('fc.activeShipmentId','active');app.values.set('fc.deliveryProofMediaKey','saved-photo');
   await app.refresh.handlers.click();assert.equal(app.list.children.length,3);assert.equal(app.list.querySelectorAll().length,0);assert.equal(app.values.get('fc.activeShipmentId'),'active');assert.equal(app.values.get('fc.deliveryProofMediaKey'),'saved-photo');assert.equal(app.navigations.length,0);
 });

test('unknown or inherited shipment states cannot produce cards or pass selection revalidation',async()=>{
 for(const status of ['constructor','toString','__proto__']){
  const invalid=await harness(async()=>({items:[{id,status}]}));assert.equal(invalid.list.children.length,0);assert.match(invalid.feedback.textContent,/confirmar a lista/);
  let calls=0;const selected=await harness(async()=>({items:[{id,status:++calls===1?'assigned':status}]}));await selected.select();assert.equal(selected.navigations.length,0);assert.equal(selected.values.has('fc.activeShipmentId'),false);
 }
});
test('history displays stored modality and update date with an explicit fallback for missing data',async()=>{
 const app=await harness(async()=>({items:[{id,status:'delivered',mode:'postal',updatedAt:'2026-10-09T12:00:00Z'},{id,status:'failed',mode:'unknown',updatedAt:'invalid'}]}),true);
 assert.match(app.list.children[0].children[2].textContent,/Envio postal.*Atualizado em:/);assert.doesNotMatch(app.list.children[0].children[2].textContent,/Data não informada/);
 assert.match(app.list.children[1].children[2].textContent,/Modalidade não informada.*Data não informada/);
});

test('timed-out consultation unlocks refresh, leaves no stale cards and preserves saved operation',async()=>{
 const signal={aborted:false};let fail,calls=0;
 const app=await harness(async(_,options)=>{calls++;assert.equal(options.signal,signal);return new Promise((_,reject)=>fail=reject)},false,signal);
 app.values.set('fc.activeShipmentId','previous');app.values.set('fc.deliveryProofMediaKey','saved-photo');assert.equal(app.refresh.disabled,true);
 signal.aborted=true;fail(new Error('aborted'));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(app.refresh.disabled,false);assert.equal(app.list.children.length,0);assert.equal(app.values.get('fc.activeShipmentId'),'previous');assert.equal(app.values.get('fc.deliveryProofMediaKey'),'saved-photo');assert.match(app.feedback.textContent,/demorou/);assert.equal(calls,1);
});
test('failed revalidation removes stale selectable cards and permits refreshed selection',async()=>{
 let calls=0;const app=await harness(async()=>{calls++;if(calls===2)throw new Error('Sessão expirada');return {items:[{id,status:'assigned'}]}});
 app.values.set('fc.deliveryProofMediaKey','saved-photo');await app.select();assert.equal(app.list.children.length,0);assert.equal(app.values.get('fc.deliveryProofMediaKey'),'saved-photo');assert.equal(app.refresh.disabled,false);
 await app.refresh.handlers.click();assert.equal(app.list.querySelectorAll().length,1);await app.select();assert.deepEqual(app.navigations,['/app/collection']);
});
