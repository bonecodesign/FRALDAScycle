import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeManufacturerAvailability} from '../packages/contracts/manufacturer-availability.js';
import {runManufacturerAvailabilityWorker} from '../workers/manufacturer-availability.js';
test('public availability is normalized as an auxiliary signal',()=>{assert.deepEqual(normalizeManufacturerAvailability({sourceUrl:'https://shop.example/item',productKey:'brand-model-p',state:'available',checkedAt:'2026-10-30T12:00:00Z'}),{sourceUrl:'https://shop.example/item',productKey:'brand-model-p',state:'available',checkedAt:'2026-10-30T12:00:00.000Z',compatibilityAuthority:'manufacturer_catalog'});});
test('availability worker runs hourly only after explicit production activation',async()=>{let calls=0;const result=await runManufacturerAvailabilityWorker({mode:'once',refresh:async()=>{calls++;return{checked:1,observations:1};}});assert.equal(calls,1);assert.equal(result,undefined);await assert.rejects(runManufacturerAvailabilityWorker({mode:'serve',env:{NODE_ENV:'production',MANUFACTURER_AVAILABILITY_REFRESH_ENABLED:'true'}}),/ativação reconhecida/);});
