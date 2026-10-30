import assert from 'node:assert/strict';
import test from 'node:test';
import {reconcileSupportedRefunds,runSupportedRefundReconciliation} from '../workers/supported-refund-reconciliation.js';
import {createPaymentProvider} from '../apps/api/payment-provider.js';
import {loadConfig} from '../apps/api/config.js';

test('reconciliation completes only a provider-confirmed refund with exact reference and amount',async()=>{const calls=[],repository={async pendingSupportedRefunds(){return[{id:'refund-1',provider_case_reference:'case-1',refund_amount_cents:4200}]},async reconcileSupportedRefund(input){calls.push(input);return{matched:true,completed:true};}},provider={async refundStatus(input){assert.equal(input.providerCaseReference,'case-1');return{providerCaseReference:'case-1',status:'completed',amountCents:4200};}},result=await reconcileSupportedRefunds({repository,provider});assert.deepEqual(result,{checked:1,completed:1,pending:0,blocked:0});assert.equal(calls[0].amountCents,4200);});

test('reconciliation reports provider errors as blocked without inventing completion',async()=>{let writes=0;const result=await reconcileSupportedRefunds({repository:{async pendingSupportedRefunds(){return[{id:'refund-1',provider_case_reference:'case-1'}]},async reconcileSupportedRefund(){writes++;}},provider:{async refundStatus(){throw new Error('offline');}}});assert.deepEqual(result,{checked:1,completed:0,pending:0,blocked:1});assert.equal(writes,0);});

test('provider refund inspection authenticates and accepts only exact structured evidence',async()=>{let request;const provider=createPaymentProvider(loadConfig({NODE_ENV:'test',PAYMENT_PROVIDER_URL:'https://payments.example.test',PAYMENT_PROVIDER_SECRET:'provider-secret'}),{fetchImpl:async(url,options)=>{request={url:String(url),options};return{ok:true,async json(){return{reference:'case-1',status:'completed',amountCents:4200};}};}}),result=await provider.refundStatus({providerCaseReference:'case-1'});assert.equal(result.amountCents,4200);assert.match(request.url,/\/refunds\/case-1$/);assert.equal(request.options.headers.authorization,'Bearer provider-secret');});

test('definitive provider failure is blocked instead of counted as pending',async()=>{const result=await reconcileSupportedRefunds({repository:{async pendingSupportedRefunds(){return[{id:'refund-1',provider_case_reference:'case-1'}]},async reconcileSupportedRefund(){return{matched:true,completed:false,blocked:true};}},provider:{async refundStatus(){return{providerCaseReference:'case-1',status:'failed',amountCents:4200};}}});assert.deepEqual(result,{checked:1,completed:0,pending:0,blocked:1});});

test('periodic reconciliation stays disabled until explicit production activation',async()=>{await assert.rejects(runSupportedRefundReconciliation({env:{NODE_ENV:'test'}}),/exige produção/);await assert.rejects(runSupportedRefundReconciliation({env:{NODE_ENV:'production',REFUND_RECONCILIATION_ENABLED:'false'}}),/exige produção/);});
