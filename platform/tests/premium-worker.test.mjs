import assert from 'node:assert/strict';
import test from 'node:test';
import {runPremiumWorker} from '../workers/premium.js';

function harness(results=[{accountsChecked:1,pausedCount:2,billingAllowed:false}]) {
  let closed=0,calls=0;const waits=[];
  const database={async close(){closed++;}};
  return {database,waits,get closed(){return closed;},get calls(){return calls;},options:{
    createDb:()=>database,
    createRepository:()=>({async regularizeExpired(){return results[Math.min(calls++,results.length-1)];}}),
    wait:async(ms,signal)=>{waits.push(ms);signal?.dispatchEvent?.(new Event('abort'));},
  }};
}

test('manual premium regularization remains local and runs exactly once without billing',async()=>{
  const run=harness(),logs=[],original=console.log;console.log=value=>logs.push(value);
  try{await runPremiumWorker({mode:'once',env:{DATABASE_URL:'postgresql://test:test@127.0.0.1:5432/test',DATABASE_SSL:'false'},...run.options});}finally{console.log=original;}
  assert.equal(run.calls,1);assert.equal(run.closed,1);assert.deepEqual(run.waits,[]);
  assert.deepEqual(JSON.parse(logs[0]),{type:'premium.regularization.completed',accountsChecked:1,pausedCount:2,billingAllowed:false});
  await assert.rejects(runPremiumWorker({mode:'once',env:{DATABASE_URL:'postgresql://test:test@database.example:5432/test'},...run.options}),/somente PostgreSQL local/);
});

test('periodic worker is explicit, bounded, sequential and stops cleanly',async()=>{
  const disabled=harness();
  await assert.rejects(runPremiumWorker({mode:'serve',env:{NODE_ENV:'production',DATABASE_URL:'postgresql://test:test@database.example:5432/test'},...disabled.options}),/PREMIUM_REGULARIZATION_ENABLED/);
  const invalid=harness();
  await assert.rejects(runPremiumWorker({mode:'serve',env:{NODE_ENV:'production',PREMIUM_REGULARIZATION_ENABLED:'true',PREMIUM_REGULARIZATION_INTERVAL_MS:'1000',DATABASE_URL:'postgresql://test:test@database.example:5432/test'},...invalid.options}),/15 minutos/);
  const run=harness(),controller=new AbortController(),original=console.log;console.log=()=>{};
  run.options.wait=async ms=>{run.waits.push(ms);controller.abort();};
  try{await runPremiumWorker({mode:'serve',signal:controller.signal,env:{NODE_ENV:'production',PREMIUM_REGULARIZATION_ENABLED:'true',PREMIUM_REGULARIZATION_INTERVAL_MS:'900000',DATABASE_URL:'postgresql://test:test@database.example:5432/test',DATABASE_SSL:'true'},...run.options});}finally{console.log=original;}
  assert.equal(run.calls,1);assert.deepEqual(run.waits,[900000]);assert.equal(run.closed,1);
});
