import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
const event=()=>({preventDefault(){},stopImmediatePropagation(){}});
function control(value='') {return {value,checked:true,disabled:false,attributes:{},handlers:{},addEventListener(name,fn){this.handlers[name]=fn},setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this.attributes[k]},closest(){return {classList:{add(){}}}}};}
async function harness({apiRequest=async()=>({proof:{id:'proof-1'}}),upload=async()=> 'synthetic/photo',location}={}) {
  const source=(await readFile(new URL('../apps/app/courier.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'');
  const values=new Map([['fc.activeShipmentId','shipment-1'],['fc.deliveryProofShipmentId','shipment-1'],['fc.deliveryProofMediaKey','synthetic/photo']]);
  const action=control(),photo=control(),recipient=control('Pessoa fictícia'),confirmation=control();
  const notices=[],navigations=[],inputs=[];
  let geoSuccess,geoFailure;
  vm.runInNewContext(source,{document:{querySelector:s=>s.includes('secondary')?photo:s.includes('data-action')?action:s.includes('form-group')?recipient:confirmation,createElement(){const input=control();input.files=[{name:'synthetic.png'}];input.click=()=>{};inputs.push(input);return input}},
    sessionStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},
    navigator:{geolocation:location??{getCurrentPosition(ok,fail){geoSuccess=ok;geoFailure=fail}}},notify:m=>notices.push(m),apiRequest,uploadListingMedia:upload,window:{location:{assign:p=>navigations.push(p)}}});
  return {values,action,photo,recipient,confirmation,notices,navigations,inputs,click:()=>action.handlers.click(event()),choose:()=>photo.handlers.click(event()),locate:()=>geoSuccess({coords:{latitude:0,longitude:0}}),deny:code=>geoFailure({code})};
}

test('proof blocks repeated submissions while locating and posting',async()=>{
  let calls=0,finish;
  const app=await harness({apiRequest:()=>{calls++;return new Promise(resolve=>finish=resolve)}});
  const pending=app.click();await app.click();assert.equal(app.action.disabled,true);assert.equal(app.recipient.disabled,true);assert.equal(calls,0);
  app.locate();await new Promise(r=>setImmediate(r));await app.click();assert.equal(calls,1);
  finish({proof:{id:'proof-1'}});await pending;
  assert.deepEqual(app.navigations,['/courier/history']);assert.equal(app.values.has('fc.deliveryProofMediaKey'),false);
});
test('denied location preserves the photo and unlocks a retry',async()=>{
  let calls=0;const app=await harness({apiRequest:async()=>{calls++;return {proof:{id:'proof-1'}}}});
  const first=app.click();app.deny();await first;assert.equal(calls,0);assert.equal(app.action.disabled,false);assert.equal(app.values.get('fc.deliveryProofMediaKey'),'synthetic/photo');assert.equal(app.navigations.length,0);
  const second=app.click();app.locate();await second;assert.equal(calls,1);
});
test('changing shipment while locating prevents sending to the previous shipment',async()=>{
  let calls=0;const app=await harness({apiRequest:async()=>{calls++}});const pending=app.click();app.values.set('fc.activeShipmentId','shipment-2');app.locate();await pending;assert.equal(calls,0);await app.click();assert.equal(app.values.has('fc.deliveryProofMediaKey'),false);
});
test('API failure or incomplete acknowledgement retains proof for retry',async()=>{
  for(const apiRequest of [async()=>{throw new Error('Serviço indisponível')},async()=>({})]){
    const app=await harness({apiRequest});const pending=app.click();app.locate();await pending;assert.equal(app.action.disabled,false);assert.equal(app.values.get('fc.deliveryProofMediaKey'),'synthetic/photo');assert.equal(app.navigations.length,0);
  }
});
test('a completed previous request cannot erase another shipment photo or redirect its screen',async()=>{
  let finish;const app=await harness({apiRequest:()=>new Promise(resolve=>finish=resolve)});const pending=app.click();app.locate();await new Promise(r=>setImmediate(r));app.values.set('fc.activeShipmentId','shipment-2');app.values.set('fc.deliveryProofShipmentId','shipment-2');app.values.set('fc.deliveryProofMediaKey','synthetic/new-photo');finish({proof:{id:'proof-1'}});await pending;assert.equal(app.values.get('fc.deliveryProofMediaKey'),'synthetic/new-photo');assert.equal(app.navigations.length,0);
});
test('photo upload cannot bind its result to a different shipment or race a proof',async()=>{
  let finish;const app=await harness({upload:()=>new Promise(resolve=>finish=resolve)});app.choose();const pending=app.inputs[0].handlers.change();assert.equal(app.action.disabled,true);await app.click();app.values.set('fc.activeShipmentId','shipment-2');finish('synthetic/new-photo');await pending;assert.equal(app.values.get('fc.deliveryProofShipmentId'),'shipment-1');assert.equal(app.photo.disabled,false);assert.match(app.notices.at(-1),/entrega selecionada mudou/);
});
test('missing confirmation, short recipient and mismatched photo prevent proof submission',async()=>{
  for(const alter of [app=>app.confirmation.checked=false,app=>app.recipient.value='X',app=>app.values.set('fc.deliveryProofShipmentId','shipment-2')]){
    const app=await harness();alter(app);await app.click();assert.equal(app.action.disabled,false);assert.equal(app.navigations.length,0);assert.equal(app.notices.length,1);
  }
});

test('location timeout and unavailable position give accurate retry feedback without losing proof',async()=>{
 for(const [code,message] of [[3,/demorou/],[2,/local com sinal/]]){
   const app=await harness();const pending=app.click();app.deny(code);await pending;assert.match(app.notices.at(-1),message);assert.equal(app.values.get('fc.deliveryProofMediaKey'),'synthetic/photo');assert.equal(app.action.disabled,false);assert.equal(app.navigations.length,0);
 }
});
