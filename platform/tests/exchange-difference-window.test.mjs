import assert from 'node:assert/strict';
import test from 'node:test';
import {exchangeDifferenceWindow} from '../packages/contracts/exchange-difference-window.js';

test('checkout warns after 20 minutes and expires after 30',()=>{
 assert.deepEqual(exchangeDifferenceWindow({selectedAt:'2030-01-01T10:00:00.000Z'}),{selectedAt:'2030-01-01T10:00:00.000Z',warningAt:'2030-01-01T10:20:00.000Z',expiresAt:'2030-01-01T10:30:00.000Z',renewalCount:0,canRenew:true});
});

test('only one renewed window is allowed',()=>{
 assert.equal(exchangeDifferenceWindow({selectedAt:'2030-01-01T10:30:00.000Z',renewalCount:1}).canRenew,false);assert.throws(()=>exchangeDifferenceWindow({selectedAt:'2030-01-01',renewalCount:2}),/invalid_exchange_difference_window/);
});
