import assert from 'node:assert/strict';
import test from 'node:test';
import {createPaymentRepository} from '../database/payment-repository.js';

test('FC-423: full wallet payment refuses confirmation without a successful reserved debit',async()=>{
  const calls=[];
  const repository=createPaymentRepository({async transaction(operation){
    return operation({async query(sql){
      calls.push(sql);
      if(calls.length===1)return {rows:[{id:'intent',method:'wallet',provider_charge_cents:0,status:'provider_pending',allocation_status:'reserved',wallet_cents:1000}]};
      if(calls.length===2)return {rowCount:0,rows:[]};
      throw new Error('Unexpected side effect after rejected debit');
    }});
  }});
  await assert.rejects(repository.completeWalletPayment({intentId:'intent',buyerId:'buyer',idempotencyKey:'synthetic'}),error=>error.code==='wallet_balance_conflict'&&error.status===409);
  assert.equal(calls.length,2);
  assert.match(calls[1],/UPDATE courier_wallet_accounts/);
});
