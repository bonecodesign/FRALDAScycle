import assert from 'node:assert/strict';
import test from 'node:test';
import {exchangeDifference} from '../packages/contracts/exchange-difference.js';

test('requester pays the owner when the offered package has the lower declared value',()=>{
 const result=exchangeDifference({requesterId:'requester',ownerId:'owner',requesterDeclaredValueCents:8000,ownerDeclaredValueCents:10000});
 assert.deepEqual(result,{payerId:'requester',recipientId:'owner',lowerValueCents:8000,higherValueCents:10000,amountCents:2000,status:'not_charged',releasePolicy:'after_bilateral_delivery_confirmation'});
});

test('owner pays requester when the requested package has the lower declared value',()=>{
 const result=exchangeDifference({requesterId:'requester',ownerId:'owner',requesterDeclaredValueCents:12000,ownerDeclaredValueCents:9000});
 assert.equal(result.payerId,'owner');assert.equal(result.recipientId,'requester');assert.equal(result.amountCents,3000);
});

test('equal declared values generate no difference obligation',()=>{
 assert.equal(exchangeDifference({requesterId:'requester',ownerId:'owner',requesterDeclaredValueCents:10000,ownerDeclaredValueCents:10000}),null);
});

test('invalid parties or values fail closed',()=>{
 for(const input of [{requesterId:'same',ownerId:'same',requesterDeclaredValueCents:100,ownerDeclaredValueCents:200},{requesterId:'a',ownerId:'b',requesterDeclaredValueCents:0,ownerDeclaredValueCents:200}])assert.throws(()=>exchangeDifference(input),/invalid_exchange_difference/);
});
