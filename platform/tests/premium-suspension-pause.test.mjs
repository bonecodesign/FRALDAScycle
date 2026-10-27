import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { premiumPauseExtension } from '../packages/contracts/premium-suspension-pause.js';
import { applyPremiumSuspensionPauses } from '../workers/premium-suspensions.js';

const input={paidPeriodStart:'2030-01-01T00:00:00Z',paidPeriodEnd:'2030-02-01T00:00:00Z',suspensionStart:'2030-01-10T00:00:00Z',suspensionEnd:'2030-01-12T00:00:00Z'};
test('account suspension extends Premium by the exact paused interval',()=>{assert.equal(premiumPauseExtension(input).extensionSeconds,2*24*60*60);});
test('overlapping suspension intervals are not counted twice',()=>{const result=premiumPauseExtension({...input,suspensionEnd:'2030-01-14T00:00:00Z',existingIntervals:[{start:'2030-01-11T00:00:00Z',end:'2030-01-13T00:00:00Z'}]});assert.equal(result.extensionSeconds,2*24*60*60);});
test('suspension outside paid period grants no extension',()=>{assert.equal(premiumPauseExtension({...input,suspensionStart:'2030-02-02T00:00:00Z',suspensionEnd:'2030-02-03T00:00:00Z'}).extensionSeconds,0);});
test('maintenance applies ended decisions without billing',async()=>{const applied=[];const repository={due:async()=>[{id:'one'},{id:'two'}],apply:async item=>{applied.push(item.id);return{extensionSeconds:item.id==='one'?3600:0};}};assert.deepEqual(await applyPremiumSuspensionPauses(repository),{checked:2,extendedSeconds:3600,billingInitiated:false});assert.deepEqual(applied,['one','two']);});
test('pause persistence is decision-idempotent and never charges a provider',async()=>{const source=await readFile(new URL('../database/premium-suspension-repository.js',import.meta.url),'utf8');assert.match(source,/premium_suspension_pauses/);assert.match(source,/FOR UPDATE/);assert.doesNotMatch(source,/createIntent|createCharge|fetch\(/);assert.match(source,/billingInitiated:false/);});
