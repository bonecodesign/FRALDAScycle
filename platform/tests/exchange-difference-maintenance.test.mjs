import assert from 'node:assert/strict';
import test from 'node:test';
import {maintainExchangeDifferences,runExchangeDifferenceMaintenance} from '../workers/exchange-difference-maintenance.js';

test('maintenance dispatches warnings before expiring second windows',async()=>{const calls=[];const result=await maintainExchangeDifferences({async dispatchDifferenceWarnings(){calls.push('warning');return{warned:2,emailQueued:1};},async expireDifferenceCheckouts(){calls.push('expiry');return{expired:1};}});assert.deepEqual(calls,['warning','expiry']);assert.deepEqual(result,{warned:2,emailQueued:1,expired:1});});
test('periodic worker is fail-closed without production flag',async()=>{await assert.rejects(runExchangeDifferenceMaintenance({mode:'serve',env:{NODE_ENV:'production',DATABASE_URL:'postgres://127.0.0.1/db'}}),/EXCHANGE_DIFFERENCE_MAINTENANCE_ENABLED/);});
