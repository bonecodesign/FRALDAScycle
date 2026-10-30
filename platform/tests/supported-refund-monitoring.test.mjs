import assert from 'node:assert/strict';
import test from 'node:test';
import {monitorSupportedRefunds} from '../workers/supported-refund-monitoring.js';
import {createPaymentService} from '../apps/api/payment-service.js';

test('monitor creates deduplicated internal alerts through the repository after the configured threshold',async()=>{let input;const result=await monitorSupportedRefunds({repository:{async flagOverdueSupportedRefunds(value){input=value;return{checked:2,created:2};}},thresholdMinutes:120});assert.deepEqual(result,{checked:2,created:2});assert.deepEqual(input,{thresholdMinutes:120,limit:50});});
test('monitor rejects unsafe alert windows',async()=>{await assert.rejects(monitorSupportedRefunds({repository:{},thresholdMinutes:5}),/entre 15 minutos/);});
test('only level 3 can read the minimal refund monitoring queue',async()=>{const service=createPaymentService({async supportedRefundQueue(){return[{id:'refund',support_ticket_id:'ticket',refund_amount_cents:4200,status:'submitted',submitted_at:'2026-10-29',alert_id:'alert',alert_created_at:'2026-10-29'}];}},{});await assert.rejects(service.supportedRefundQueue({id:'support',role:'moderator',staffAccessLevel:2}),error=>error.code==='insufficient_access_level');const result=await service.supportedRefundQueue({id:'finance',role:'admin',staffAccessLevel:3});assert.equal(result.items[0].alert.kind,'provider_confirmation_overdue');assert.equal(Object.hasOwn(result.items[0],'transactionId'),false);});
