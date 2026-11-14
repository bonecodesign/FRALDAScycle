import assert from 'node:assert/strict';
import test from 'node:test';
import {executeAuthorizedWalletResolutions,runWalletResolutionExecution} from '../workers/courier-wallet-resolutions.js';

test('resolution worker executes each authorized item once through the repository',async()=>{const calls=[];const result=await executeAuthorizedWalletResolutions({repository:{authorizedBlockedResolutions:async()=>[{id:'return'},{id:'retry'}],executeAuthorizedResolution:async({resolutionId})=>(calls.push(resolutionId),{resolutionId,result:resolutionId==='retry'?'retry_queued':'wallet_returned',reused:false})}});assert.deepEqual(calls,['return','retry']);assert.deepEqual({found:result.found,executed:result.executed,failed:result.failed},{found:2,executed:2,failed:0});});

test('resolution worker reports an isolated failure without inventing execution',async()=>{const result=await executeAuthorizedWalletResolutions({repository:{authorizedBlockedResolutions:async()=>[{id:'failed'}],executeAuthorizedResolution:async()=>{throw Object.assign(new Error('conflict'),{code:'wallet_balance_conflict'});}}});assert.equal(result.executed,0);assert.equal(result.failed,1);assert.equal(result.results[0].errorCode,'wallet_balance_conflict');});

test('production execution remains disabled without both explicit flags',async()=>{for(const env of [{},{NODE_ENV:'production',COURIER_WALLET_RESOLUTION_EXECUTION_ENABLED:'true'}])await assert.rejects(runWalletResolutionExecution({env}),/ativação explícita/);});
