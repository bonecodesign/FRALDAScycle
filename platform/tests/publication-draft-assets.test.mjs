import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarketplaceProviders } from '../apps/api/marketplace-providers.js';
import { approximatePublicationLocation,publicationLocationFields } from '../packages/contracts/publication-draft-assets.js';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('draft photo access requires ownership and verified processing before signing',async()=>{
  const requests=[];
  const key='listings/owner/photo.webp';
  let processed=true;
  const provider=createMarketplaceProviders({mediaProviderUrl:'https://media.example/sign',mediaProviderSecret:'private'},async(url,options)=>{
    const input=JSON.parse(options.body);requests.push(input);
    return {ok:true,json:async()=>input.operation==='verify-listing-media'?{storageKey:key,ownerId:'owner',exists:true,processed,immutable:true,contentType:'image/webp',exifRemoved:true,scanStatus:'clean',sizeBytes:1024,width:800,height:600}:{readUrl:'https://media.example/photo?token=temporary',expiresAt:new Date(Date.now()+60_000).toISOString()}};
  });
  for(const storageKey of ['listings/other/photo.webp','private/proof.webp','listings/owner/../photo.webp'])await assert.rejects(provider.signedListingRead('owner',{storageKey}),error=>error.code==='invalid_media');
  assert.equal(requests.length,0);
  const media=await provider.signedListingRead('owner',{storageKey:key});
  assert.deepEqual(requests.map(item=>item.operation),['verify-listing-media','signed-read']);
  assert.equal(requests[1].requesterId,'owner');
  assert.equal(requests[1].expiresInSeconds,300);
  assert.match(media.readUrl,/^https:/);
  processed=false;requests.length=0;
  await assert.rejects(provider.signedListingRead('owner',{storageKey:key}),error=>error.code==='media_not_ready');
  assert.equal(requests.length,1);
});

test('location uses actual city and UF with approximate coordinates; editing discards cached coordinates',()=>{
  const resolved=approximatePublicationLocation({city:'Recife',state:'PE',latitude:-8.063147,longitude:-34.871228});
  assert.deepEqual(resolved,{city:'Recife',state:'PE',latitude:-8.06,longitude:-34.87});
  const draft={city:'Recife',state:'PE',postalCode:'50000-000',neighborhood:'Boa Vista',resolvedLocation:{...resolved,address:'50000-000|Boa Vista'}};
  assert.deepEqual(publicationLocationFields(draft),resolved);
  for(const patch of [{postalCode:'51000-000'},{neighborhood:'Outro bairro'},{city:'Olinda'},{resolvedLocation:null}]){
    const input=publicationLocationFields({...draft,...patch});assert.equal(input.latitude,null);assert.equal(input.longitude,null);
  }
  assert.throws(()=>publicationLocationFields({city:'',state:'PE'}),/Informe cidade/);
  assert.throws(()=>approximatePublicationLocation({city:'Recife',state:'PE',latitude:null,longitude:0}),/coordenadas válidas/);
});

class Element{
  constructor(tag){this.tag=tag;this.children=[];this.handlers={}}
  append(...nodes){this.children.push(...nodes)}
  setAttribute(){}
  removeAttribute(name){delete this[name]}
  addEventListener(event,handler){this.handlers[event]=handler}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function photoHarness(read){
  const source=(await readFile(new URL('../packages/contracts/publication-draft-assets.js',import.meta.url),'utf8')).replaceAll('export function','function');
  const timers=new Map();let id=0;
  const context={document:{createElement:tag=>new Element(tag)},URL,Date,setTimeout(callback){timers.set(++id,callback);return id},clearTimeout(key){timers.delete(key)}};
  vm.createContext(context);vm.runInContext(source,context);
  const host=new Element('div');const mounted=context.mountPublicationPhoto(host,'listings/owner/photo.webp',read);await tick();
  return {host,mounted,timers};
}

test('photo preview waits for image load and removes access on expiry or leaving the page',async()=>{
  const ui=await photoHarness(async()=>({readUrl:'https://media.example/photo',expiresAt:new Date(Date.now()+60_000).toISOString()}));
  const [image,status]=ui.host.children;
  assert.equal(image.hidden,true);image.naturalWidth=800;image.onload();
  assert.equal(image.hidden,false);assert.match(status.textContent,/carregada/);
  [...ui.timers.values()][0]();assert.equal(image.hidden,true);assert.equal(image.src,undefined);assert.match(status.textContent,/expirou/);
  ui.mounted.dispose();assert.equal(ui.timers.size,0);
});

test('pending or unsafe media never appears and late responses after disposal are ignored',async()=>{
  for(const read of [async()=>{throw Object.assign(new Error('pending'),{code:'media_not_ready'})},async()=>({readUrl:'http://unsafe/photo',expiresAt:new Date(Date.now()+60_000).toISOString()})]){
    const ui=await photoHarness(read);assert.equal(ui.host.children[0].src,undefined);assert.equal(ui.host.children[2].disabled,false);ui.mounted.dispose();
  }
  let finish;
  const ui=await photoHarness(()=>new Promise(resolve=>{finish=resolve}));ui.mounted.dispose();finish({readUrl:'https://media.example/photo',expiresAt:new Date(Date.now()+60_000).toISOString()});await tick();assert.equal(ui.host.children[0].src,undefined);
});
