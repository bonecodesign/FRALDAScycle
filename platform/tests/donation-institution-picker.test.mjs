import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.handlers={};this.value='';}
  append(...children){this.children.push(...children)}
  replaceChildren(){this.children=[]}
  setAttribute(){}
  addEventListener(event,handler){this.handlers[event]=handler}
}
async function harness(request,selectedId=''){
  const source=(await readFile(new URL('../packages/contracts/donation-institution-picker.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'').replaceAll('export function','function');
  const context={document:{createElement:tag=>new Element(tag)},URLSearchParams};
  vm.createContext(context);vm.runInContext(source,context);
  const host=new Element('section');let condition='sealed',chosen;
  const picker=context.mountDonationInstitutionPicker(host,{request,selectedId,getCondition:()=>condition,onChange:item=>{chosen=item}});
  await tick();
  return {host,picker,get chosen(){return chosen},setCondition(value){condition=value;picker.refresh()}};
}
const institutions=[{id:'closed-only',public_name:'Nome <sem HTML>',city:'Recife',state:'PE',open_packages_accepted:false},{id:'open-ok',public_name:'Aberto',open_packages_accepted:true}];

test('picker requires explicit selection and clears an incompatible open-package destination',async()=>{
  const ui=await harness(async()=>({items:institutions}));
  assert.equal(ui.picker.validate(),false);
  const select=ui.host.children[0].children[1];
  assert.equal(select.children[1].textContent,'Nome <sem HTML> — Recife — PE');
  select.value='closed-only';select.handlers.change();
  assert.equal(ui.picker.validate(),true);
  ui.setCondition('open');
  assert.equal(ui.picker.validate(),false);
  assert.equal(ui.chosen,null);
  assert.equal(select.children.length,2);
  select.value='open-ok';select.handlers.change();
  assert.equal(ui.picker.validate(),true);
});

test('empty and unavailable institution lists remain blocked; retry loads actual results',async()=>{
  const empty=await harness(async()=>({items:[]}));
  assert.equal(empty.picker.validate(),false);
  assert.match(empty.host.children[3].textContent,/Nenhuma instituição/);
  let fail=true;
  const ui=await harness(async()=>{if(fail)throw new Error('offline');return {items:institutions}},'open-ok');
  assert.equal(ui.picker.validate(),false);
  assert.match(ui.host.children[3].textContent,/Não foi possível/);
  assert.equal(ui.host.children[5].hidden,false);
  fail=false;ui.host.children[5].handlers.click();await tick();
  assert.equal(ui.picker.validate(),false); // no automatic choice after failure
  assert.equal(ui.host.children[0].children[1].children.length,3);
});

test('pagination preserves selection and disposal prevents late response updates',async()=>{
  let calls=0;
  const first=Array.from({length:100},(_,i)=>({id:String(i),public_name:String(i)}));
  const ui=await harness(async path=>{calls++;assert.ok(path.includes(calls===1?'offset=0':'offset=100'));assert.equal(new URLSearchParams(path.split('?')[1]).has('city'),false);return {items:calls===1?first:[{id:'extra',public_name:'Extra'}]}},'3');
  assert.equal(ui.picker.validate(),true);
  ui.host.children[1].children[1].value='Outra cidade'; // takes effect only with a new search
  ui.host.children[4].handlers.click();await tick();
  assert.equal(ui.chosen.id,'3');
  assert.equal(ui.host.children[0].children[1].children.length,102);
  let finish;
  const late=await harness(()=>new Promise(resolve=>{finish=resolve}));
  late.picker.dispose();finish({items:institutions});await tick();
  assert.equal(late.picker.validate(),false);
  assert.equal(late.host.children[0].children[1].children.length,0);
});
