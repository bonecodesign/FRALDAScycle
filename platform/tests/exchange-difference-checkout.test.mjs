import assert from 'node:assert/strict';
import test from 'node:test';
import {exchangeDifferenceCheckout} from '../packages/contracts/exchange-difference-checkout.js';

test('PIX and tokenized credit are the only one-installment methods',()=>{
 assert.deepEqual(exchangeDifferenceCheckout({method:'pix',installments:1}),{method:'pix',installments:1,paymentMethodToken:null});
 assert.deepEqual(exchangeDifferenceCheckout({method:'credit',installments:1,paymentMethodToken:'provider-token'}),{method:'credit',installments:1,paymentMethodToken:'provider-token'});
});

test('checkout rejects installments, raw card data and unsupported methods',()=>{
 for(const input of [{method:'credit',installments:2,paymentMethodToken:'token'},{method:'credit',installments:1},{method:'pix',paymentMethodToken:'token'},{method:'debit'},{method:'credit',paymentMethodToken:'token',cardNumber:'4111111111111111'},{method:'credit',paymentMethodToken:'token',cvv:'123'}])assert.throws(()=>exchangeDifferenceCheckout(input),/invalid_exchange_difference_checkout/);
});
