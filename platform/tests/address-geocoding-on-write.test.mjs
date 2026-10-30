import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createLogisticsService } from '../apps/api/logistics-service.js';
import { loadConfig } from '../apps/api/config.js';

test('delivery quote activation requires write-time Google Maps geocoding',()=>{
  assert.throws(()=>loadConfig({NODE_ENV:'test',DELIVERY_QUOTE_CHECKOUT_ENABLED:'true'}),/GOOGLE_MAPS_GEOCODING_ENABLED/);
  const config=loadConfig({NODE_ENV:'test',DELIVERY_QUOTE_CHECKOUT_ENABLED:'true',GOOGLE_MAPS_GEOCODING_ENABLED:'true',GOOGLE_MAPS_API_KEY:'server-key'});
  assert.equal(config.googleMapsGeocodingEnabled,true);assert.equal(config.deliveryQuoteCheckoutEnabled,true);
});

test('address creation geocodes exact address before persistence',async()=>{
  let persisted,requested;const service=createLogisticsService({async createAddress(userId,input){persisted={userId,input};return input;}},null,null,{addressGeocoder:{async geocodeBh(address){requested=address;return{latitude:-19.92,longitude:-43.94,provider:'google-maps',partialMatch:false};}}});
  await service.createAddress('user-1',{label:'Casa',postalCode:'30110-000',street:'Rua A',number:'10',district:'Centro',city:'Belo Horizonte',state:'MG'});
  assert.match(requested,/Rua A, 10/);assert.equal(persisted.input.latitude,-19.92);
  assert.equal(persisted.input.longitude,-43.94);assert.equal(persisted.input.geocodeProvider,'google-maps');
  assert.ok(Number.isFinite(Date.parse(persisted.input.geocodeVerifiedAt)));
});

test('partial geocode is rejected and registration persistence supports verified provenance',async()=>{
  const service=createLogisticsService({createAddress(){assert.fail('must not persist');}},null,null,{addressGeocoder:{async geocodeBh(){return{latitude:-19.92,longitude:-43.94,provider:'google-maps',partialMatch:true};}}});
  await assert.rejects(service.createAddress('user-1',{label:'Casa',postalCode:'30110000',street:'Rua A',number:'10',district:'Centro',city:'Belo Horizonte',state:'MG'}),error=>error.code==='address_geocode_partial');
  const source=await readFile(new URL('../database/responsible-registration-repository.js',import.meta.url),'utf8');
  assert.match(source,/geocode_verified_at,geocode_provider/);assert.match(source,/input\.address\.geocode\?\.latitude/);
});
