import assert from 'node:assert/strict';
import test from 'node:test';
import {createPaymentService} from '../apps/api/payment-service.js';
import {createPaymentRepository} from '../database/payment-repository.js';

test('FC-430: initial provider response cannot finalize payment',async()=>{
 const repo=createPaymentRepository({async query(sql,values){
  assert.match(sql,/status='provider_pending' AND provider_reference IS NULL/);
  assert.equal(values[2],'pending');
  return {rowCount:1,rows:[{status:values[2]}]};
 }});
 assert.equal((await repo.attachProvider({intentId:'synthetic',providerReference:'fixture',status:'paid'})).status,'pending');
});

test('FC-430: attachment failure preserves the existing reservation',async()=>{
 const tx='11111111-1111-4111-8111-111111111111';
 let failures=0,attempts=0;
 const repo={
  async context(){return {existing:false,transaction:{id:tx,buyer_id:'buyer',status:'initiated',kind:'sale',amount_cents:1000}};},
  async createIntent(){return {id:'synthetic'};},
  async attachProvider(input){assert.equal(input.status,'pending');throw new Error('synthetic persistence failure');},
  async markProviderFailure(){failures++;}
 };
 const service=createPaymentService(repo,{async createIntent(){attempts++;return {providerReference:'fixture',status:'paid',checkout:{}};}});
 await assert.rejects(service.createIntent('buyer',{transactionId:tx,idempotencyKey:'synthetic-fc430-key',method:'pix'}),/synthetic persistence failure/);
 assert.equal(attempts,1);
 assert.equal(failures,0);
});
