import assert from 'node:assert/strict';
import test from 'node:test';
import {exchangeDisputeResponse} from '../packages/contracts/exchange-dispute-response.js';

test('party response accepts agreement or contest with a reference',()=>{
 assert.deepEqual(exchangeDisputeResponse({response:'contest',statementReference:'statement:123'}),{response:'contest',statementReference:'statement:123'});
});

test('party response rejects unsupported choices and unsafe references',()=>{
 for(const input of [{response:'silent',statementReference:'statement:123'},{response:'agree',statementReference:''},{response:'contest',statementReference:'a\nb'}])assert.throws(()=>exchangeDisputeResponse(input),/invalid_exchange_dispute_response/);
});
