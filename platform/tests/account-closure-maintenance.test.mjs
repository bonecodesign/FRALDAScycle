import assert from 'node:assert/strict';
import test from 'node:test';
import { maintainAccountClosures } from '../workers/account-closure.js';

test('closure maintenance classifies due requests but never authorizes automatic erasure',async()=>{const calls=[];const repository={due:async()=>[{id:'a',user_id:'u1'},{id:'b',user_id:'u2'}],reviewDue:async input=>{calls.push(input);return input.requestId==='a'?{changed:true,status:'awaiting_obligations'}:{changed:true,status:'ready_for_review'};}};assert.deepEqual(await maintainAccountClosures(repository),{checked:2,changed:2,awaitingObligations:1,readyForReview:1,automaticErasureAllowed:false});assert.deepEqual(calls,[{requestId:'a',userId:'u1'},{requestId:'b',userId:'u2'}]);});

test('closure repository review contract checks live operational obligations and audits no-erasure state',async()=>{const source=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../database/account-closure-repository.js',import.meta.url),'utf8'));assert.match(source,/status NOT IN\('completed','cancelled','refunded'\)/);assert.match(source,/payment_cases/);assert.match(source,/operational_disputes/);assert.match(source,/automaticErasureAllowed:false/);assert.doesNotMatch(source,/DELETE FROM users|TRUNCATE/);});
