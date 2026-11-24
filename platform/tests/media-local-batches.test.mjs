import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateConcurrentSyntheticListings } from '../tools/media-local-batches.mjs';

const av = () => ({
  status:'local-eicar-self-test-passed-not-homologated',actualAvScannerExecuted:true,
  checks:{
    engineAndSigtool:'passed',dailySignatureFileRecent:'passed',
    signatureMetadataInspected:'passed',benignSyntheticImage:'passed',
    eicarHarmlessTestDetected:'passed',
  },
});
const listing = (id,ownerId,photos) => ({id,ownerId,
  photos:photos.map((c,i)=>({id:'photo-'+id+'-'+(i+1),case:c}))});
const clean = 'local-only-pass-requires-human-review';
const decisionFor = ({case:c}) => ({
  'synthetic-clean':clean,
  'synthetic-phone':'blocked-external-contact',
  'synthetic-qr':'blocked-qr-code',
  'synthetic-eicar':'blocked-threat-before-decoding',
  'synthetic-corrupted':'blocked-image-decoder',
}[c]);
const options = (fn,extra={}) => ({avSelfTest:av(),processPhoto:fn,...extra});
const fakeWorker = async job => ({...job,decision:decisionFor(job)});

test('FC-366: three artificial listings, six photos, concurrent peak exactly 2 and zero release',async()=>{
  const batches=[
    listing('listing-a','owner-a',['synthetic-clean']),
    listing('listing-b','owner-b',['synthetic-clean','synthetic-phone']),
    listing('listing-c','owner-c',['synthetic-qr','synthetic-eicar','synthetic-corrupted']),
  ];
  let active=0,peak=0;
  const result=await evaluateConcurrentSyntheticListings(batches,options(async job=>{
    active++;peak=Math.max(peak,active);
    await new Promise(resolve=>setTimeout(resolve,6));
    active--;
    return fakeWorker(job);
  }));
  assert.equal(result.peakConcurrentWorkers,2);
  assert.equal(peak,2);
  assert.equal(result.maxConcurrentWorkers,2);
  assert.equal(result.processedPhotoCount,6);
  assert.deepEqual(result.summaries.map(x=>x.status),[
    'local-only-review-required','blocked-batch','blocked-batch',
  ]);
  assert.ok(result.summaries.every(s=>!s.anyPhotoReleased &&
    s.signedPreviewUrlsIssued===0 && !s.publicationAuthorized));
  assert.equal(result.operationalReleaseAllowed,false);
  assert.equal(result.officialMediaGatesPromoted,false);
  assert.doesNotMatch(JSON.stringify(result),/Contato:|Eicar-Test-Signature|99999-0000/i);
});

test('FC-366: timeout, scanner failure or foreign/incorrect owner fails WHOLE listing',async()=>{
  const batches=[
    listing('listing-a','owner-a',['synthetic-clean']),
    listing('listing-b','owner-b',['synthetic-clean','synthetic-qr']),
    listing('listing-c','owner-c',['synthetic-clean','synthetic-phone']),
  ];
  for(const scenario of ['throw','hang','foreign-owner','foreign-photo','published','unknown']){
    const result=await evaluateConcurrentSyntheticListings(batches,options(async job=>{
      if(job.listingId==='listing-b'&&job.case==='synthetic-clean'){
        if(scenario==='throw') throw new Error('sensitive scan text should not be logged');
        if(scenario==='hang') return new Promise(()=>{});
        if(scenario==='foreign-owner') return {...job,ownerId:'owner-other',decision:clean};
        if(scenario==='foreign-photo') return {...job,photoId:'photo-mismatch',decision:clean};
        if(scenario==='published') return {...job,decision:'published'};
        if(scenario==='unknown') return {...job,decision:'scan-status-clean'};
      }
      return fakeWorker(job);
    },{photoTimeoutMs:scenario==='hang'?10:100}));
    assert.deepEqual(result.summaries.map(x=>x.status),[
      'local-only-review-required','blocked-batch-error','blocked-batch',
    ],scenario);
    assert.equal(result.summaries[1].anyPhotoReleased,false);
    assert.equal(result.summaries[1].signedPreviewUrlsIssued,0);
    assert.doesNotMatch(JSON.stringify(result),/sensitive scan text/);
  }
});

test('FC-366: strict artificial input, ownership and 1-8 photos; no real input paths',async()=>{
  for(const batches of [
    [], [listing('listing-a','owner-a',[])],
    [listing('listing-a','owner-a',Array(9).fill('synthetic-clean'))],
    [listing('listing-a','owner-a',['synthetic-clean','not-a-real-photo'])],
    [listing('listing-a','../owner',['synthetic-clean'])],
    [listing('listing-a','owner-a',['synthetic-clean']),
     listing('listing-a','owner-b',['synthetic-qr'])],
    [listing('listing-a','owner-a',['synthetic-clean']),
     {id:'listing-b',ownerId:'owner-b',photos:[{id:'photo-listing-a-1',case:'synthetic-clean'}]}],
    Array.from({length:9},(_,i)=>listing('listing-'+i,'owner-'+i,['synthetic-clean'])),
    [listing('listing-a','owner-a',Array(8).fill('synthetic-clean')),
     listing('listing-b','owner-b',Array(8).fill('synthetic-clean')),
     listing('listing-c','owner-c',['synthetic-clean'])],
  ]){
    await assert.rejects(
      evaluateConcurrentSyntheticListings(batches,options(fakeWorker)),
    );
  }
  await assert.rejects(evaluateConcurrentSyntheticListings(
    [listing('listing-a','owner-a',['synthetic-clean'])],
    options(fakeWorker,{maxConcurrent:3})));
  await assert.rejects(evaluateConcurrentSyntheticListings(
    [listing('listing-a','owner-a',['synthetic-clean'])],
    options(fakeWorker,{photoTimeoutMs:0})));
});

test('FC-366: absent/stale or invented AV self-test blocks any scheduled photo',async()=>{
  let count=0;
  const batches=[listing('listing-a','owner-a',['synthetic-clean'])];
  for(const mutation of [
    x=>{x.status='blocked-no-antivirus-clearance';},
    x=>{x.actualAvScannerExecuted=false;},
    x=>{x.checks.dailySignatureFileRecent='blocked';},
    x=>{delete x.checks.eicarHarmlessTestDetected;},
    x=>{x.checks.fake='passed';},
  ]){
    const proof=av();mutation(proof);
    await assert.rejects(evaluateConcurrentSyntheticListings(batches,{
      avSelfTest:proof,processPhoto:async job=>{count++;return fakeWorker(job);},
    }));
  }
  assert.equal(count,0);
});

test('FC-366: eight safe artificial images stay review-only and worker limit 1 respected',async()=>{
  const result=await evaluateConcurrentSyntheticListings(
    [listing('listing-a','owner-a',Array(8).fill('synthetic-clean'))],
    options(fakeWorker,{maxConcurrent:1}));
  assert.equal(result.peakConcurrentWorkers,1);
  assert.equal(result.summaries[0].artificialPhotoCount,8);
  assert.equal(result.summaries[0].status,'local-only-review-required');
  assert.equal(result.summaries[0].publicationAuthorized,false);
});
