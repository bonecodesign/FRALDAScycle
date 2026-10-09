import assert from 'node:assert/strict';
import test from 'node:test';
import {validatePublicationDraft,parsePublicationRegion} from '../packages/contracts/publication-validation.js';
const draft={kind:'sale',category:'infant',brand:'Babysec',model:'Premium',size:'G',quantity:'32',packageCondition:'sealed',description:'Pacote lacrado, armazenado em lugar seco.',expiry:'08/2027',delivery:'Retirada no local',priceCents:3700,postalCode:'50000-000',neighborhood:'Boa Vista',city:'Recife',state:'PE'};
const options={mediaKeys:['listings/owner/photo.webp']};

test('valid sale, exchange and institution donation can proceed with explicit draft fields',()=>{
  assert.deepEqual(validatePublicationDraft(draft,options),[]);
  assert.deepEqual(validatePublicationDraft({...draft,kind:'exchange',priceCents:null},options),[]);
  assert.deepEqual(validatePublicationDraft({...draft,kind:'donation',priceCents:null,packageCondition:'open',openPackageAttested:true,institutionId:'11111111-1111-4111-8111-111111111111',expiry:'2027-08'},options),[]);
});

test('missing fields report all correction steps instead of inventing product data',()=>{
  const issues=validatePublicationDraft({});
  assert.deepEqual([...new Set(issues.map(item=>item.step))],[1,2,3,4,6,7]);
  assert.ok(issues.every(item=>item.message));
  const openSale=validatePublicationDraft({...draft,packageCondition:'open'},options);
  assert.ok(openSale.some(item=>item.code==='condition'));
  assert.ok(openSale.some(item=>item.code==='attestation'));
  for(const malformed of [null,[],42,{title:42,description:42}])assert.ok(validatePublicationDraft(malformed).length);
});

test('quantity, expiry, media and text boundaries reject bad drafts',()=>{
  for(const [patch,code] of [[{quantity:'1.5'},'quantity'],[{quantity:'100001'},'quantity'],[{expiry:'00/2027'},'expiry'],[{expiry:'2027-13'},'expiry'],[{title:'x'.repeat(121)},'title'],[{description:'x'.repeat(4000)},'description'],[{brand:'Unknown'},'model'],[{size:'INVALID'},'size'],[{state:'ZZ'},'city']])assert.ok(validatePublicationDraft({...draft,...patch},options).some(item=>item.code===code));
  for(const mediaKeys of [[],['listings/owner/../photo.webp'],Array(9).fill('listings/owner/photo.webp')])assert.ok(validatePublicationDraft(draft,{mediaKeys}).some(item=>item.code==='photo'));
});

test('site location parsing separates neighborhood, city and UF without leaking UF into city',()=>{
  const region=parsePublicationRegion('Boa Vista, Recife - pe');
  assert.deepEqual(region,{neighborhood:'Boa Vista',city:'Recife',state:'PE'});
  assert.deepEqual(validatePublicationDraft({...draft,...region,postalCode:null},{...options,surface:'site'}),[]);
  assert.ok(validatePublicationDraft({...draft,...parsePublicationRegion('Bairro apenas')},{...options,surface:'site'}).some(item=>item.step===7));
});
