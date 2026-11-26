import assert from 'node:assert/strict';
import test from 'node:test';
import {createPaymentRepository} from '../database/payment-repository.js';

test('FC-423: full wallet payment refuses confirmation without a successful reserved debit',async()=>{
  const calls=[];
  const repository=createPaymentRepository({async transaction(operation){
    return operation({async query(sql){
      calls.push(sql);
      if(calls.length===1)return {rows:[{id:'intent',method:'wallet',provider_charge_cents:0,status:'provider_pending',allocation_status:'reserved',transaction_status:'payment_pending',wallet_cents:1000}]};
      if(calls.length===2)return {rowCount:0,rows:[]};
      throw new Error('Unexpected side effect after rejected debit');
    }});
  }});
  await assert.rejects(repository.completeWalletPayment({intentId:'intent',buyerId:'buyer',idempotencyKey:'synthetic'}),error=>error.code==='wallet_balance_conflict'&&error.status===409);
  assert.equal(calls.length,2);
  assert.match(calls[1],/UPDATE courier_wallet_accounts/);
});

test('FC-424: cancelled transaction cannot debit wallet or grant contact',async()=>{
  const calls=[];
  const repository=createPaymentRepository({async transaction(operation){
    return operation({async query(sql){
      calls.push(sql);
      if(calls.length===1)return {rows:[{id:'intent',method:'wallet',provider_charge_cents:0,status:'provider_pending',allocation_status:'reserved',transaction_status:'cancelled',wallet_cents:1000}]};
      throw new Error('Unexpected side effect after cancellation');
    }});
  }});
  await assert.rejects(repository.completeWalletPayment({intentId:'intent',buyerId:'buyer',idempotencyKey:'synthetic'}),error=>error.code==='wallet_payment_state_conflict'&&error.status===409);
  assert.equal(calls.length,1);
  assert.match(calls[0],/FOR UPDATE OF p,a,t/);
});
