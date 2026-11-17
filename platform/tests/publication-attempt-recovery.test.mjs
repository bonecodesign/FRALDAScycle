import assert from 'node:assert/strict';
import test from 'node:test';
import {preparePublicationAttempt,publicationAttemptFailed,pendingPublicationSource} from '../packages/contracts/publication-attempt.js';

function memoryStorage(){
  const values=new Map();
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
}
const key='fc.publishAttempt';
const draft={draft:{kind:'sale',priceCents:3700,stockUnits:2},mediaKey:'listings/owner/photo.webp'};
const build=async()=>({priceCents:3700,stockUnits:2});

test('same draft reuses the same idempotency key after an uncertain network failure',async()=>{
  const storage=memoryStorage();
  const first=await preparePublicationAttempt(storage,key,draft,build);
  publicationAttemptFailed(storage,key,new TypeError('network unavailable'));
  assert.deepEqual(pendingPublicationSource(storage,key),draft);
  const second=await preparePublicationAttempt(storage,key,{mediaKey:draft.mediaKey,draft:{stockUnits:2,priceCents:3700,kind:'sale'}},()=>{throw Error('must not rebuild')});
  assert.deepEqual(second,first);
  assert.match(first.idempotencyKey,/^[0-9a-f-]{36}$/i);
});

test('uncertain submission blocks changes to price, photo or package count until reconciled',async()=>{
  const storage=memoryStorage();
  await preparePublicationAttempt(storage,key,draft,build);
  publicationAttemptFailed(storage,key,{status:503});
  for(const source of [
    {...draft,draft:{...draft.draft,priceCents:4200}},
    {...draft,draft:{...draft.draft,stockUnits:3}},
    {...draft,mediaKey:'listings/owner/other.webp'},
  ])await assert.rejects(preparePublicationAttempt(storage,key,source,build),/envio anterior/);
});

test('definitive validation errors allow a corrected submission with a new key',async()=>{
  const storage=memoryStorage();
  const first=await preparePublicationAttempt(storage,key,draft,build);
  publicationAttemptFailed(storage,key,{status:422});
  assert.equal(storage.getItem(key),null);
  assert.equal(pendingPublicationSource(storage,key),null);
  const next=await preparePublicationAttempt(storage,key,{...draft,draft:{...draft.draft,priceCents:4200}},async()=>({priceCents:4200}));
  assert.notEqual(next.idempotencyKey,first.idempotencyKey);
  assert.equal(next.priceCents,4200);
});

test('timeouts, rate limits and conflicts retain recovery evidence',async()=>{
  for(const error of [{status:408},{status:429},{status:500},{status:409,code:'listing_creation_conflict'}]){
    const storage=memoryStorage();
    await preparePublicationAttempt(storage,key,draft,build);
    publicationAttemptFailed(storage,key,error);
    assert.deepEqual(pendingPublicationSource(storage,key),draft);
  }
});

test('corrupt saved attempt does not expose source and can be replaced safely',async()=>{
  const storage=memoryStorage();
  storage.setItem(key,'{broken json');
  assert.equal(pendingPublicationSource(storage,key),null);
  const payload=await preparePublicationAttempt(storage,key,draft,build);
  assert.equal(payload.priceCents,3700);
});
