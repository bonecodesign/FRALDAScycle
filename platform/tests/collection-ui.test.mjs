import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
const id='11111111-1111-4111-8111-111111111111';
const old='22222222-2222-4222-8222-222222222222';
async function harness({role='courier',post=async()=>({collection:{id,status:'picked_up'}})}={}){
  const source=(await readFile(new URL('../apps/app/collection.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'');
  const values=new Map([['fc.activeShipmentId',old],['fc.deliveryProofShipmentId',old],['fc.deliveryProofMediaKey','synthetic/old-photo']]);
  const fieldset={disabled:true},feedback={},next={hidden:true},calls=[];
  const form={elements:{shipmentId:{value:id},confirmed:{checked:true}},querySelector:()=>fieldset,setAttribute(){},removeAttribute(){},addEventListener(_,fn){this.submit=fn}};
  vm.runInNewContext(source,{document:{getElementById:key=>({'collection-form':form,'collection-feedback':feedback,'collection-next':next})[key]},sessionStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},apiRequest:async(path,options)=>{if(!options)return {user:{role}};calls.push({path,options});return post()}});
  await new Promise(resolve=>setImmediate(resolve));form.elements.shipmentId.value=id;
  return {form,fieldset,feedback,next,values,calls,submit:()=>form.submit({preventDefault(){}})};
}
test('confirmed collection selects its shipment and clears only a different shipment photo',async()=>{
  const app=await harness();await app.submit();assert.equal(app.values.get('fc.activeShipmentId'),id);assert.equal(app.values.has('fc.deliveryProofMediaKey'),false);assert.equal(app.next.hidden,false);assert.equal(app.form.elements.confirmed.checked,false);
  const same=await harness();same.values.set('fc.deliveryProofShipmentId',id);await same.submit();assert.equal(same.values.get('fc.deliveryProofMediaKey'),'synthetic/old-photo');
});
test('pending collection cannot be repeated',async()=>{
  let finish;const app=await harness({post:()=>new Promise(resolve=>finish=resolve)});const pending=app.submit();await app.submit();assert.equal(app.calls.length,1);assert.equal(app.fieldset.disabled,true);finish({collection:{id,status:'picked_up'}});await pending;assert.equal(app.fieldset.disabled,false);
});
test('collection failure and malformed acknowledgement preserve selection and confirmation',async()=>{
  for(const post of [async()=>{throw new Error('Entrega não atribuída')},async()=>({}),async()=>({collection:{id:old,status:'picked_up'}})]){
    const app=await harness({post});await app.submit();assert.equal(app.values.get('fc.activeShipmentId'),old);assert.equal(app.values.get('fc.deliveryProofMediaKey'),'synthetic/old-photo');assert.equal(app.form.elements.confirmed.checked,true);assert.equal(app.next.hidden,true);assert.equal(app.fieldset.disabled,false);
  }
});
test('response cannot overwrite a shipment selected while collection was pending',async()=>{
  let finish;const app=await harness({post:()=>new Promise(resolve=>finish=resolve)});const pending=app.submit();app.values.set('fc.activeShipmentId','33333333-3333-4333-8333-333333333333');finish({collection:{id,status:'picked_up'}});await pending;assert.notEqual(app.values.get('fc.activeShipmentId'),id);assert.equal(app.next.hidden,true);
});
test('unauthorized account, invalid ID and missing confirmation cannot submit collection',async()=>{
  const unauthorized=await harness({role:'buyer'});await unauthorized.submit();assert.equal(unauthorized.calls.length,0);assert.equal(unauthorized.fieldset.disabled,true);
  for(const alter of [a=>a.form.elements.shipmentId.value='invalid',a=>a.form.elements.confirmed.checked=false]){const app=await harness();alter(app);await app.submit();assert.equal(app.calls.length,0);}
});
test('already delivered collection does not suggest another proof',async()=>{
  const app=await harness({post:async()=>({collection:{id,status:'delivered',reused:true}})});await app.submit();assert.equal(app.values.get('fc.activeShipmentId'),id);assert.equal(app.next.hidden,true);
});
