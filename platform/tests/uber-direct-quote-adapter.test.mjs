import assert from 'node:assert/strict';
import test from 'node:test';
import { createUberDirectQuoteClient } from '../apps/api/uber-direct-quote-client.js';
import { createUberDirectQuoteAdapter } from '../apps/api/uber-direct-quote-adapter.js';
import { loadConfig } from '../apps/api/config.js';

const now=Date.parse('2030-01-01T12:00:00Z'),transactionId='transaction-1';
const participant=(ownerId,suffix)=>({address:{id:`a-${suffix}`,street:'Rua A',number:'1',district:'Centro',city:'Belo Horizonte',state:'MG',postalCode:'30110000'},geocode:{addressId:`a-${suffix}`,latitude:-19.92,longitude:-43.94,verifiedAt:'2030-01-01T11:00:00Z'},consent:{transactionId,ownerId,addressId:`a-${suffix}`,noticeVersion:'FC-DELIVERY-QUOTE-1',revokedAt:null}});

test('Uber Direct remains disabled until gateway and homologation are explicit',()=>{
  assert.equal(loadConfig({NODE_ENV:'test'}).uberDirectQuotingEnabled,false);
  assert.throws(()=>loadConfig({NODE_ENV:'test',UBER_DIRECT_QUOTING_ENABLED:'true'}),/homologation/);
  assert.equal(loadConfig({NODE_ENV:'test',UBER_DIRECT_QUOTING_ENABLED:'true',UBER_DIRECT_HOMOLOGATION_ACKNOWLEDGED:'true',UBER_DIRECT_QUOTE_PROVIDER_URL:'https://uber-gateway.example.test',UBER_DIRECT_QUOTE_PROVIDER_SECRET:'secret'}).uberDirectQuotingEnabled,true);
});

test('normalized Uber Direct gateway authenticates and is idempotent',async()=>{
  let request;const client=createUberDirectQuoteClient({endpoint:'https://gateway.example.test/base',secret:'secret',fetchImpl:async(url,options)=>{request={url:String(url),options};return{ok:true,async json(){return{quoteId:'uber-direct-quote-1',priceCents:3000,currency:'BRL',expiresAt:'2030-01-01T12:05:00Z'};}};}});
  const result=await client.quote({transactionId,stops:[{},{}]});
  assert.match(request.url,/\/quotes$/);assert.equal(request.options.headers.authorization,'Bearer secret');
  assert.equal(request.options.headers['idempotency-key'],`delivery-quote:${transactionId}`);assert.equal(result.priceCents,3000);
});

test('Uber Direct adapter requires authorized route and adds five percent',async()=>{
  let calls=0;const adapter=createUberDirectQuoteAdapter({enabled:true,now:()=>now,client:{async quote(){calls++;return{quoteId:'uber-direct-quote-1',priceCents:3000,currency:'BRL',expiresAt:'2030-01-01T12:05:00.000Z'};}}});
  assert.equal((await adapter({transactionId,origin:participant('seller','s'),destination:{...participant('buyer','b'),consent:null}})).reason,'address_consent_missing');assert.equal(calls,0);
  const result=await adapter({transactionId,origin:participant('seller','s'),destination:participant('buyer','b')});
  assert.equal(result.quote.provider,'uber_direct');assert.equal(result.quote.baseFreightCents,3000);
  assert.equal(result.quote.platformFeeCents,150);assert.equal(result.quote.customerTotalCents,3150);
});
