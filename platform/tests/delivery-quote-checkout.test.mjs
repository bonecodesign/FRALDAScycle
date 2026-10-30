import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeliveryQuoteService } from '../apps/api/delivery-quote-service.js';
import { loadConfig } from '../apps/api/config.js';

const transactionId='11111111-1111-4111-8111-111111111111';
const context={transactionId,senderId:'seller',recipientId:'buyer',origin:{geocode:{latitude:-19.93,longitude:-43.94}},destination:{geocode:{latitude:-19.90,longitude:-43.91}},request:{originAddressId:'origin',originAddressVersion:1,destinationAddressId:'destination',destinationAddressVersion:1,mode:'express',listingId:'listing',quantity:1,packageVersion:1}};

test('automatic checkout quoting remains off by default and production needs acknowledgement',async()=>{
  assert.equal(loadConfig({NODE_ENV:'test'}).deliveryQuoteCheckoutEnabled,false);
  const service=createDeliveryQuoteService({},{orchestrator:{quote(){throw new Error('must not call');}}});
  await assert.rejects(service.calculateCheckout('buyer',transactionId),error=>error.code==='delivery_quote_checkout_disabled');
  const production={NODE_ENV:'production',DATABASE_URL:'postgres://db',SESSION_SECRET:'x'.repeat(32),NOTIFICATION_WEBHOOK_URL:'https://notify.test',NOTIFICATION_WEBHOOK_SECRET:'secret'};
  assert.throws(()=>loadConfig({...production,DELIVERY_QUOTE_CHECKOUT_ENABLED:'true',GOOGLE_MAPS_GEOCODING_ENABLED:'true',GOOGLE_MAPS_API_KEY:'server-key'}),/GOOGLE_MAPS_ACTIVATION_ACKNOWLEDGED/);
  assert.throws(()=>loadConfig({...production,DELIVERY_QUOTE_CHECKOUT_ENABLED:'true',GOOGLE_MAPS_GEOCODING_ENABLED:'true',GOOGLE_MAPS_API_KEY:'server-key',GOOGLE_MAPS_ACTIVATION_ACKNOWLEDGED:'true'}),/DELIVERY_QUOTE_CHECKOUT_ACTIVATION_ACKNOWLEDGED/);
});

test('checkout loads private route internally and returns only persisted commercial fields',async()=>{
  let orchestrationInput,storedInput;const repository={async checkoutContext(input){assert.deepEqual(input,{userId:'buyer',transactionId});return context;},async register(input){storedInput=input;return{id:'quote-db',provider:input.provider,base_freight_cents:input.baseFreightCents,platform_fee_cents:input.platformFeeCents,customer_total_cents:input.customerTotalCents,expires_at:input.expiresAt};}};
  const service=createDeliveryQuoteService(repository,{checkoutEnabled:true,orchestrator:{async quote(input){orchestrationInput=input;return{selected:'lalamove',quote:{provider:'lalamove',quoteId:'lalamove-quote-1',baseFreightCents:2000,customerTotalCents:2100,currency:'BRL',expiresAt:new Date(Date.now()+60000).toISOString()}};}}});
  const result=await service.calculateCheckout('buyer',transactionId);
  assert.ok(orchestrationInput.routeDistanceKm>0);assert.equal(storedInput.transactionId,transactionId);
  assert.deepEqual(Object.keys(result.quote).sort(),['baseFreightCents','currency','customerTotalCents','expiresAt','id','platformFeeCents','provider']);
  assert.equal(JSON.stringify(result).includes('latitude'),false);assert.equal(JSON.stringify(result).includes('street'),false);
});
