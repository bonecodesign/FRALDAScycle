import assert from 'node:assert/strict';
import test from 'node:test';
import { createRegisteredCourierQuoteAdapter } from '../apps/api/registered-courier-quote-adapter.js';
import { loadConfig } from '../apps/api/config.js';

const input={senderId:'seller',recipientId:'buyer',routeDistanceKm:7,
  destination:{geocode:{latitude:-19.92,longitude:-43.94}}};

test('registered courier quoting is off unless eligibility and quoting are enabled',()=>{
  assert.equal(loadConfig({NODE_ENV:'test'}).registeredCourierQuotingEnabled,false);
  assert.throws(()=>loadConfig({NODE_ENV:'test',REGISTERED_COURIER_QUOTING_ENABLED:'true'}),/requires COURIER_ELIGIBILITY_ENABLED/);
});

test('closest eligible courier produces fixed platform quote without changing courier amount',async()=>{
  let query;
  const adapter=createRegisteredCourierQuoteAdapter({enabled:true,now:()=>Date.parse('2030-01-01T12:00:00Z'),repository:{async rankEligible(value){query=value;return[{courierId:'courier-near',priority:1,distanceToRecipientKm:1.25},{courierId:'courier-next',priority:2,distanceToRecipientKm:2.5}];}}});
  const result=await adapter(input);
  assert.equal(query.senderId,'seller');assert.equal(query.recipientId,'buyer');
  assert.equal(result.available,true);assert.equal(result.quote.provider,'fraldacycle_courier');
  assert.equal(result.quote.baseFreightCents,1800);assert.equal(result.quote.platformFeeCents,90);
  assert.equal(result.quote.customerTotalCents,1890);assert.equal(result.quote.courierId,'courier-near');
  assert.equal(result.quote.courierDistanceToRecipientKm,1.25);
  assert.deepEqual(result.quote.courierCandidates,[{courierId:'courier-near',priority:1,distanceToRecipientKm:1.25},{courierId:'courier-next',priority:2,distanceToRecipientKm:2.5}]);
});

test('missing eligible courier or route outside tariff coverage remains unavailable',async()=>{
  const none=createRegisteredCourierQuoteAdapter({enabled:true,repository:{async closestEligible(){return null;}}});
  assert.equal((await none(input)).reason,'eligible_courier_unavailable');
  const far=createRegisteredCourierQuoteAdapter({enabled:true,repository:{async closestEligible(){return{courierId:'courier',distanceToRecipientKm:2};}}});
  assert.equal((await far({...input,routeDistanceKm:21})).reason,'outside_coverage');
});
