import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const id='11111111-1111-4111-8111-111111111111';
function element(){return {children:[],disabled:false,handlers:{},append(...nodes){this.children.push(...nodes)},replaceChildren(){this.children=[]},addEventListener(type,fn){this.handlers[type]=fn},querySelectorAll(){return this.children.flatMap(panel=>panel.children.filter(node=>node.type==='button'))}}}
async function harness(apiRequest){
 const source=(await readFile(new URL('../apps/app/courier-dashboard.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'');
 const list=element(),refresh=element(),feedback=element(),values=new Map(),navigations=[];
 vm.runInNewContext(source,{document:{getElementById:key=>({'courier-deliveries':list,'courier-feedback':feedback,'courier-refresh':refresh})[key],createElement:()=>element()},apiRequest,sessionStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},window:{location:{assign:path=>navigations.push(path)}}});
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
