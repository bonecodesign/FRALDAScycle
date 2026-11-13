import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import test from 'node:test';
import {createWalletPayoutWebhookService} from '../apps/api/wallet-payout-webhook-service.js';
import {loadConfig} from '../apps/api/config.js';

const secret='wallet-webhook-secret-for-tests';
function signed(payload,seconds=1_900_000_000){const raw=Buffer.from(JSON.stringify(payload)),signature=`v1=${createHmac('sha256',secret).update(`${seconds}.`).update(raw).digest('hex')}`;return{raw,timestamp:String(seconds),signature};}

test('signed terminal payout event is normalized without trusting an amount',async()=>{let received;const service=createWalletPayoutWebhookService({reconcileProviderEvent:async value=>(received=value,{withdrawal:{status:'completed'},reused:false})},{secret,now:()=>1_900_000_000_000});const input=signed({id:'event-terminal-0001',providerReference:'provider-transfer-0001',status:'completed'});const result=await service.receive(input);assert.equal(result.withdrawal.status,'completed');assert.match(received.providerReferenceHash,/^[a-f0-9]{64}$/);assert.match(received.evidenceSha256,/^[a-f0-9]{64}$/);assert.match(received.idempotencyKey,/^wallet-webhook:[a-f0-9]{64}$/);assert.equal(JSON.stringify(received).includes('provider-transfer-0001'),false);});

test('webhook rejects tampering, supplied amounts and failures without a code',async()=>{const service=createWalletPayoutWebhookService({reconcileProviderEvent:async()=>assert.fail('repository must not be called')},{secret,now:()=>1_900_000_000_000});const valid=signed({id:'event-terminal-0002',providerReference:'provider-transfer-0002',status:'completed'});await assert.rejects(service.receive({...valid,signature:'v1='+'0'.repeat(64)}),error=>error.code==='invalid_wallet_payout_webhook_signature');for(const payload of [{id:'event-terminal-0003',providerReference:'provider-transfer-0003',status:'completed',amountCents:2000},{id:'event-terminal-0004',providerReference:'provider-transfer-0004',status:'failed'}])await assert.rejects(service.receive(signed(payload)),error=>error.code==='invalid_wallet_payout_webhook_payload');});

test('production configuration keeps payout callbacks fail-closed',()=>{const base={NODE_ENV:'production',DATABASE_URL:'postgres://test',SESSION_SECRET:'s'.repeat(32),NOTIFICATION_WEBHOOK_URL:'https://notify.example.test',NOTIFICATION_WEBHOOK_SECRET:'notify-secret'};assert.throws(()=>loadConfig({...base,COURIER_WALLET_PAYOUTS_ENABLED:'true'}),/activation acknowledgement and webhook secret/);const config=loadConfig({...base,COURIER_WALLET_PAYOUTS_ENABLED:'true',COURIER_WALLET_PAYOUTS_ACTIVATION_ACKNOWLEDGED:'true',WALLET_PAYOUT_WEBHOOK_SECRET:'w'.repeat(32)});assert.equal(config.courierWalletPayoutsEnabled,true);});
