import assert from 'node:assert/strict';
import test from 'node:test';
import { createLoggiQuoteClient } from '../apps/api/loggi-quote-client.js';
import { createLoggiQuoteAdapter } from '../apps/api/loggi-quote-adapter.js';
import { loadConfig } from '../apps/api/config.js';

const now=Date.parse('2030-01-01T12:00:00Z'),transactionId='transaction-1';
const participant=(ownerId,suffix)=>({address:{id:`a-${suffix}`,street:'Rua A',number:'1',district:'Centro',city:'Belo Horizonte',state:'MG',postalCode:'30110000'},geocode:{addressId:`a-${suffix}`,latitude:-19.92,longitude:-43.94,verifiedAt:'2030-01-01T11:00:00Z'},consent:{transactionId,ownerId,addressId:`a-${suffix}`,noticeVersion:'FC-DELIVERY-QUOTE-1',revokedAt:null}});

test('Loggi remains disabled until gateway and homologation are explicit',()=>{
  assert.equal(loadConfig({NODE_ENV:'test'}).loggiQuotingEnabled,false);
  assert.throws(()=>loadConfig({NODE_ENV:'test',LOGGI_QUOTING_ENABLED:'true'}),/homologation/);
  assert.equal(loadConfig({NODE_ENV:'test',LOGGI_QUOTING_ENABLED:'true',LOGGI_HOMOLOGATION_ACKNOWLEDGED:'true',LOGGI_QUOTE_PROVIDER_URL:'https://loggi-gateway.example.test',LOGGI_QUOTE_PROVIDER_SECRET:'secret'}).loggiQuotingEnabled,true);
});

test('normalized Loggi gateway uses authentication and idempotency',async()=>{
  let request;const client=createLoggiQuoteClient({endpoint:'https://gateway.example.test/base',secret:'secret',fetchImpl:async(url,options)=>{request={url:String(url),options};return{ok:true,async json(){return{quoteId:'loggi-quote-1',priceCents:2000,currency:'BRL',expiresAt:'2030-01-01T12:05:00Z'};}};}});
  const result=await client.quote({transactionId,stops:[{},{}]});
  assert.match(request.url,/\/quotes$/);assert.equal(request.options.headers.authorization,'Bearer secret');
  assert.equal(request.options.headers['idempotency-key'],`delivery-quote:${transactionId}`);assert.equal(result.priceCents,2000);
});

test('Loggi adapter adds five percent and requires authorized route',async()=>{
  let calls=0;const adapter=createLoggiQuoteAdapter({enabled:true,now:()=>now,client:{async quote(){calls++;return{quoteId:'loggi-quote-1',priceCents:2000,currency:'BRL',expiresAt:'2030-01-01T12:05:00.000Z'};}}});
  assert.equal((await adapter({transactionId,origin:participant('seller','s'),destination:{...participant('buyer','b'),consent:null}})).reason,'address_consent_missing');assert.equal(calls,0);
  const result=await adapter({transactionId,origin:participant('seller','s'),destination:participant('buyer','b')});
  assert.equal(result.quote.baseFreightCents,2000);assert.equal(result.quote.platformFeeCents,100);assert.equal(result.quote.customerTotalCents,2100);
});
