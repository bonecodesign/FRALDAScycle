import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import { publicationText } from '../packages/contracts/publication-review.js';
import { publicationLocationFields } from '../packages/contracts/publication-draft-assets.js';
import { validatePublicationDraft } from '../packages/contracts/publication-validation.js';
import { preparePublicationAttempt,publicationAttemptFailed } from '../packages/contracts/publication-attempt.js';

async function appHarness(publishListing, withPhoto=true, draft={kind:'sale',priceCents:4200}) {
  const source=(await readFile(new URL('../apps/app/publish.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'');
  const values=new Map([['fc.publishDraft',JSON.stringify({category:'infant',brand:'Pampers',model:'Confort Sec',size:'M',quantity:'50',packageCondition:'sealed',description:'Pacote lacrado, armazenado em lugar seco.',expiry:'08/2027',delivery:'Entrega por parceiro',postalCode:'50000-000',neighborhood:'Boa Vista',priceCents:4200,city:'Recife',state:'PE',...draft})]]);
  if(withPhoto)values.set('fc.publishMediaKey','listings/owner/photo.webp');
  let click;
  const button={disabled:false,addEventListener(event,handler){click=handler}};
  const content={replaceChildren(state){this.state=state}};
  const notices=[];
  const context={
    document:{getElementById(){return null},querySelector(selector){return selector==='#publish-submit'?button:content},createElement(){return {append(...children){this.children=children}}}},
    sessionStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},
    publishListing,publicationText,publicationLocationFields,validatePublicationDraft,preparePublicationAttempt,publicationAttemptFailed,listingPrice:()=>4200,notify:message=>notices.push(message),location:{},
  };
  vm.runInNewContext(source,context);
  return {click,button,content,values,notices};
}

test('missing photo prevents submission and preserves the draft',async()=>{
  let calls=0;
  const app=await appHarness(async()=>{calls++},false);
  await app.click();
  assert.equal(calls,0);
  assert.equal(app.button.disabled,false);
  assert.ok(app.values.has('fc.publishDraft'));
  assert.match(app.notices[0],/Adicione uma foto/);
});

test('donation submission requires and passes the chosen institution; sale excludes it',async()=>{
  let body;
  const submit=async input=>{body=input;return {listing:{id:'donation-id',status:'review'}}};
  const missing=await appHarness(submit,true,{kind:'donation'});
  await missing.click();
  assert.equal(body,undefined);
  assert.match(missing.notices[0],/instituição destinatária/);
  const institutionId='11111111-1111-4111-8111-111111111111';
  const selected=await appHarness(submit,true,{kind:'donation',institutionId});
  await selected.click();
  assert.equal(body.institutionId,institutionId);
  const sale=await appHarness(submit,true,{kind:'sale',institutionId:'old-id'});
  await sale.click();
  assert.equal(body.institutionId,null);
});

test('partial and invalid drafts cannot reach publication or lose their saved data',async()=>{
  for(const patch of [{model:''},{quantity:'0'},{description:''},{expiry:'13/2027'},{delivery:''},{state:'ZZ'},{priceCents:null}]){
    let calls=0;
    const app=await appHarness(async()=>{calls++},true,{kind:'sale',...patch});
    await app.click();
    assert.equal(calls,0);
    assert.ok(app.values.has('fc.publishDraft'));
    assert.ok(app.values.has('fc.publishMediaKey'));
    assert.equal(app.button.disabled,false);
    assert.ok(app.notices[0]);
  }
});

test('pending submission cannot be repeated; review receipt clears only successful draft',async()=>{
  let finish,calls=0;
  const app=await appHarness(()=>{calls++;return new Promise(resolve=>{finish=resolve})});
  const pending=app.click();
  await new Promise(resolve=>setImmediate(resolve));
  await app.click();
  assert.equal(calls,1);
  finish({listing:{id:'listing-id',status:'review'}});
  await pending;
  assert.equal(app.values.has('fc.publishDraft'),false);
  assert.equal(app.values.has('fc.publishMediaKey'),false);
  assert.equal(app.values.get('fc.lastListingId'),'listing-id');
  const [heading,explanation,link]=app.content.state.children;
  assert.equal(heading.textContent,'Anúncio enviado para revisão');
  assert.match(explanation.textContent,/ainda não está visível/);
  assert.equal(link.href,'/app/profile-ads');
});

test('processing failure retains photo and draft for retry without success screen',async()=>{
  const app=await appHarness(async()=>{throw new Error('Foto em processamento')});
  await app.click();
  assert.ok(app.values.has('fc.publishDraft'));
  assert.ok(app.values.has('fc.publishMediaKey'));
  assert.equal(app.content.state,undefined);
  assert.equal(app.button.disabled,false);
});

test('submitted title and description match the review text and never substitute example product data',async()=>{
  const draft={kind:'sale',category:'infant',brand:'Babysec',model:'Premium',size:'G',quantity:'32',packageCondition:'sealed',description:'Pacote lacrado, armazenado em lugar seco.',expiry:'08/2027',delivery:'Entrega por parceiro',postalCode:'50000-000',neighborhood:'Boa Vista'};
  let body;
  const app=await appHarness(async input=>{body=input;return {listing:{id:'actual-id',status:'review'}}},true,draft);
  await app.click();
  assert.equal(body.title,publicationText(draft).title);
  assert.equal(body.description,publicationText(draft).description);
  assert.equal(body.quantity,32);
  assert.equal(body.brand,'Babysec');
  assert.equal(body.city,'Recife');
  assert.equal(body.state,'PE');
  assert.equal(body.latitude,null);
  assert.doesNotMatch(body.description,/50000-000/);
});
