import assert from 'node:assert/strict';
import test from 'node:test';
import {createMarketplaceService} from '../apps/api/marketplace-service.js';
import {createMarketplaceRepository} from '../database/marketplace-repository.js';
import {preparePublicationAttempt,publicationAttemptFailed,pendingPublicationSource} from '../packages/contracts/publication-attempt.js';
const owner='11111111-1111-4111-8111-111111111111',key='22222222-2222-4222-8222-222222222222';
const input={title:'Pacote Pampers Confort Sec',description:'Pacote fechado, lacrado e armazenado em local seco.',category:'infant',brand:'Pampers',model:'Confort Sec',size:'M',quantity:50,kind:'sale',priceCents:3500,packageCondition:'sealed',mediaKeys:[`listings/${owner}/photo.webp`],idempotencyKey:key};

test('service returns an existing creation without checking providers again and rejects changed data',async()=>{
  let saved,writes=0,checks=0;
  const service=createMarketplaceService({
    async creationByKey(user,key,hash){if(!saved)return null;assert.equal(user,owner);if(hash!==saved.creationFingerprint)throw Object.assign(new Error('changed'),{code:'listing_creation_conflict',status:409});return {id:'one',status:'review',reused:true}},
    async create(value){saved=value;writes++;return {id:'one',status:'review'}},
  },null,{async verifyListingMedia(){checks++}});
  await service.create(owner,input);const retry=await service.create(owner,input);
  assert.equal(retry.id,'one');assert.equal(retry.reused,true);assert.equal(writes,1);assert.equal(checks,1);
  await assert.rejects(service.create(owner,{...input,quantity:60}),error=>error.code==='listing_creation_conflict');
  await assert.rejects(service.create(owner,{...input,idempotencyKey:'bad'}),error=>error.code==='invalid_listing_creation_key');
});

test('repository rechecks the key under the seller lock and returns current status without another write',async()=>{
  const calls=[];
  const client={async query(sql,values){calls.push(sql);if(sql.includes('FOR NO KEY UPDATE'))return {rows:[{id:owner}]};if(sql.includes('AS checked_at'))return {rows:[{checked_at:'2026-10-09T00:00:00Z',subscription:null}]};if(sql.includes('creation_key=$2'))return {rows:[{id:'one',status:'published',published_at:'now',creation_fingerprint:'a'.repeat(64)}]};throw new Error(sql)}};
  const repository=createMarketplaceRepository({transaction:callback=>callback(client)});
  const result=await repository.create({...input,sellerId:owner,creationFingerprint:'a'.repeat(64)});
  assert.equal(result.status,'published');assert.equal(result.reused,true);
  assert.ok(calls[0].includes('FOR NO KEY UPDATE'));assert.ok(calls.at(-1).includes('creation_key=$2'));
  assert.equal(calls.some(sql=>sql.includes('INSERT')),false);
  await assert.rejects(repository.create({...input,sellerId:owner,creationFingerprint:'b'.repeat(64)}),error=>error.code==='listing_creation_conflict');
});

test('first creation records listing, photo and request identity together; retry inserts nothing',async()=>{
  const calls=[];let saved;
  const client={async query(sql,values){
    calls.push(sql);
    if(sql.includes('FOR NO KEY UPDATE'))return {rows:[{id:owner}]};
    if(sql.includes('AS checked_at'))return {rows:[{checked_at:'2026-10-09T00:00:00Z',subscription:null}]};
    if(sql.startsWith('SELECT')&&sql.includes('creation_key=$2'))return {rows:saved?[saved]:[]};
    if(sql.includes('AS suspended'))return {rows:[{suspended:false}]};
    if(sql.includes('count(*)'))return {rows:[{count:0}]};
    if(sql.includes('INSERT INTO listings'))return {rows:[{id:'one',status:'review',published_at:null}]};
    if(sql.includes('UPDATE listings SET creation_key'))saved={id:values[0],status:'review',published_at:null,creation_fingerprint:values[2]};
    return {rows:[]};
  }};
  let transactions=0;
  const repository=createMarketplaceRepository({transaction:async callback=>{transactions++;return callback(client)}});
  const request={...input,sellerId:owner,creationFingerprint:'a'.repeat(64)};
  await repository.create(request);await repository.create(request);
  assert.equal(transactions,2);
  assert.equal(calls.filter(sql=>sql.includes('INSERT INTO listings')).length,1);
  assert.equal(calls.filter(sql=>sql.includes('INSERT INTO listing_media')).length,1);
  assert.equal(calls.filter(sql=>sql.includes('UPDATE listings SET creation_key')).length,1);
});

test('retry retains exact payload and key across reload, including originally resolved location',async()=>{
  const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  let builds=0;
  const first=await preparePublicationAttempt(storage,'attempt',{draft:{title:'One',city:'Recife'}},async()=>{builds++;return {title:'One',latitude:-8.06}});
  publicationAttemptFailed(storage,'attempt',{status:0});
  const retry=await preparePublicationAttempt(storage,'attempt',{draft:{city:'Recife',title:'One'}},async()=>{builds++;return {latitude:0}});
  assert.deepEqual(retry,first);assert.equal(builds,1);
  await assert.rejects(preparePublicationAttempt(storage,'attempt',{draft:{title:'Changed'}},async()=>({})),/envio anterior/);
  assert.equal(pendingPublicationSource(storage,'attempt').draft.title,'One');
  publicationAttemptFailed(storage,'attempt',{status:401});assert.ok(values.has('attempt'));
});

test('a definite first rejection permits correction with a new key',async()=>{
  const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const first=await preparePublicationAttempt(storage,'attempt',{title:'One'},async()=>({title:'One'}));
  publicationAttemptFailed(storage,'attempt',{status:422});assert.equal(values.has('attempt'),false);
  const corrected=await preparePublicationAttempt(storage,'attempt',{title:'Corrected'},async()=>({title:'Corrected'}));
  assert.notEqual(corrected.idempotencyKey,first.idempotencyKey);
});
