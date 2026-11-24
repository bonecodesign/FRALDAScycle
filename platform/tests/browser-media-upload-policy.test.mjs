import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  sendSignedBrowserPhoto, validatedBrowserMediaUpload,
} from '../packages/contracts/browser-media-upload-policy.js';

const now = Date.parse('2026-11-23T12:00:00.000Z');
const file = Object.freeze({type:'image/png',size:2_048});
const signed = Object.freeze({
  storageKey:'listings/synthetic-owner/sample.webp',
  uploadUrl:'https://objects.example.test/upload/sample?X-Amz-Signature=synthetic',
  expiresAt:new Date(now+120_000).toISOString(),
  headers:{'x-amz-meta-purpose':'listing-synthetic'},
});

test('FC-358: valid signed photo PUT omits browser cookies and refuses redirects',async()=>{
  const requests=[];
  const result=await sendSignedBrowserPhoto(file,signed,async(url,options)=>{
    requests.push({url,options});
    return {ok:true,status:200};
  },now);
  assert.equal(result,signed.storageKey);
  assert.equal(requests.length,1);
  const {url,options}=requests[0];
  assert.equal(url,signed.uploadUrl);
  assert.equal(options.method,'PUT');
  assert.equal(options.redirect,'error');
  assert.equal(options.credentials,'omit');
  assert.equal(options.body,file);
  assert.deepEqual(options.headers,{
    'content-type':'image/png',
    'x-amz-meta-purpose':'listing-synthetic',
  });
  assert.equal(Object.hasOwn(options.headers,'authorization'),false);
  assert.equal(Object.hasOwn(options.headers,'cookie'),false);
});

test('FC-358: no photo leaves browser before invalid or expired signed destinations',async()=>{
  let networkCalls=0;
  const fetchImpl=async()=>{networkCalls++;return {ok:true};};
  const destinations=[
    'http://objects.example.test/photo',
    'https://127.0.0.1/private',
    'https://2130706433/private',
    'https://[::1]/private',
    'https://localhost/private',
    'https://cdn.local/private',
    'https://cdn.internal/private',
    'https://user:secret@objects.example.test/upload',
    'https://objects.example.test/upload#fragment',
    'https://objects.example.test/white space',
  ];
  for(const url of destinations) {
    await assert.rejects(
      sendSignedBrowserPhoto(file,{...signed,uploadUrl:url},fetchImpl,now),
      err=>err.code==='invalid_signed_media_upload',
      url,
    );
  }
  for(const patch of [
    {expiresAt:new Date(now-1).toISOString()},
    {expiresAt:new Date(now+900_001).toISOString()},
    {expiresAt:'not-a-date'},
    {storageKey:'listings/../../private/file.png'},
    {storageKey:'private/other-user/photo.webp'},
    {storageKey:'listings/synthetic-owner/evil"\r\nkey'},
    {uploadUrl:null},
    {headers:{authorization:'Bearer synthetic'}},
    {headers:{cookie:'synthetic'}},
    {headers:{origin:'https://example.test'}},
    {headers:{'Content-Type':'text/html'}},
    {headers:{'x-safe':'bad\r\nheader'}},
    {headers:[]},
    {headers:new Date(now)},
  ]) {
    await assert.rejects(
      sendSignedBrowserPhoto(file,{...signed,...patch},fetchImpl,now),
      err=>err.code==='invalid_signed_media_upload',
      JSON.stringify(patch),
    );
  }
  for(const badFile of [
    {type:'text/html',size:128},
    {type:'image/png',size:0},
    {type:'image/png',size:10_000_001},
    {type:'image/png',size:20.5},
    null,
  ]) {
    await assert.rejects(
      sendSignedBrowserPhoto(badFile,signed,fetchImpl,now),
      err=>err.code==='invalid_signed_media_upload',
    );
  }
  assert.equal(networkCalls,0);
});

test('FC-358: failed or rejected uploads never return a usable storage key',async()=>{
  await assert.rejects(
    sendSignedBrowserPhoto(file,signed,async()=>({ok:false,status:403}),now),
    err=>err.code==='upload_failed'&&err.status===403,
  );
  await assert.rejects(
    sendSignedBrowserPhoto(file,signed,async()=>{throw new TypeError('redirect blocked');},now),
    err=>err.code==='upload_failed',
  );
  await assert.rejects(
    sendSignedBrowserPhoto(file,signed,async()=>null,now),
    err=>err.code==='upload_failed',
  );
  assert.throws(
    ()=>validatedBrowserMediaUpload(signed,file,Number.NaN),
    err=>err.code==='invalid_signed_media_upload',
  );
});

test('FC-358: app publication uses signed-URL validation instead of direct unguarded fetch',async()=>{
  const source=await readFile(new URL('../packages/contracts/marketplace-ui.js',import.meta.url),'utf8');
  const method=source.slice(source.indexOf('export async function uploadListingMedia('),source.indexOf('export async function geocodeLocation('));
  assert.match(method,/sendSignedBrowserPhoto\(file, upload\)/);
  assert.doesNotMatch(method,/fetch\(upload\.uploadUrl/);
  assert.doesNotMatch(method,/\.\.\.upload\.headers/);
});
