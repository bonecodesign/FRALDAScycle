import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {readSitePublicationDraft,saveSitePublicationDraft,clearSitePublicationDraft} from '../packages/contracts/site-publication-draft.js';

test('site draft restores fields, photo reference and current step without storing temporary URLs',()=>{
  const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const data={type:'Doação',title:'Babysec G',quantity:'',price:'abc',condition:'open',openPackageAttested:true,expiry:'2027-08',institutionId:'institution',readUrl:'https://private.example/signed',preview:'blob:temporary'};
  saveSitePublicationDraft(storage,{data,mediaKey:'listings/owner/photo.webp',step:4});
  const restored=readSitePublicationDraft(storage);
  assert.equal(restored.data.quantity,'');assert.equal(restored.data.price,'abc');assert.equal(restored.data.openPackageAttested,true);
  assert.equal(restored.step,4);assert.equal(restored.mediaKey,'listings/owner/photo.webp');
  assert.doesNotMatch([...values.values()][0],/readUrl|private.example|blob:temporary/);
  clearSitePublicationDraft(storage);assert.equal(readSitePublicationDraft(storage),null);
});

test('corrupt saved drafts and unsupported fields cannot masquerade as a restored upload',()=>{
  for(const value of ['invalid','null','[]','42',JSON.stringify({version:2})])assert.equal(readSitePublicationDraft({getItem:()=>value}),null);
  const result=readSitePublicationDraft({getItem:()=>JSON.stringify({version:1,step:99,data:{title:null,quantity:false,openPackageAttested:'true'},mediaKey:'listings/owner/../photo.webp'})});
  assert.deepEqual(result,{data:{},step:1,mediaKey:null});
});

class Element{
  constructor(tag){this.tag=tag;this.children=[];this.handlers={}}
  append(...nodes){this.children.push(...nodes)}
  replaceChildren(...nodes){this.children=nodes}
  setAttribute(){}
  addEventListener(event,handler){this.handlers[event]=handler}
  click(){this.handlers.click?.()}
}
async function harness(upload,key='listings/owner/old.webp'){
  const source=(await readFile(new URL('../packages/contracts/publication-upload.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'').replaceAll('export function','function');
  let input;const updates=[],ready=[],previews=[];
  const context={document:{createElement(tag){const element=new Element(tag);if(tag==='input')input=element;return element}},mountPublicationPhoto(host,key){previews.push(key);return {dispose(){}}}};
  vm.createContext(context);vm.runInContext(source,context);
  const host=new Element('div');const mounted=context.mountPublicationUpload(host,{storageKey:key,upload,readPhoto(){},onUploaded:key=>updates.push(key),onReady:value=>ready.push(value)});
  return {host,mounted,updates,ready,previews,async select(file){host.children[2].click();input.files=[file];return input.handlers.change()}};
}
const file={type:'image/webp',size:2048};

test('restored app photo permits keeping the uploaded reference without another upload',async()=>{
  let calls=0;const ui=await harness(async()=>{calls++});
  assert.equal(ui.ready.at(-1),true);assert.equal(calls,0);assert.deepEqual(ui.previews,['listings/owner/old.webp']);
  assert.equal(ui.host.children[2].textContent,'Trocar foto');ui.mounted.dispose();
});

test('failed replacement retains previous photo and permits retry; success changes it only after upload',async()=>{
  let fail=true;const ui=await harness(async()=>{if(fail)throw new Error('Upload indisponível');return 'listings/owner/new.webp'});
  await ui.select(file);assert.deepEqual(ui.updates,[]);assert.equal(ui.ready.at(-1),true);assert.match(ui.host.children[1].textContent,/foto anterior foi mantida/);
  fail=false;await ui.select(file);assert.deepEqual(ui.updates,['listings/owner/new.webp']);assert.equal(ui.previews.at(-1),'listings/owner/new.webp');ui.mounted.dispose();
});

test('invalid file and late upload after leaving the page never replace the saved reference',async()=>{
  let calls=0,finish;
  const ui=await harness(()=>{calls++;return new Promise(resolve=>{finish=resolve})});
  await ui.select({type:'text/html',size:10});assert.equal(calls,0);assert.equal(ui.ready.at(-1),true);
  const pending=ui.select(file);assert.equal(ui.ready.at(-1),false);ui.mounted.dispose();finish('listings/owner/new.webp');await pending;assert.deepEqual(ui.updates,[]);
});
