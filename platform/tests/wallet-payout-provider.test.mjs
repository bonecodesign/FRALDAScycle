import assert from 'node:assert/strict';
import test from 'node:test';
import {createWalletPayoutProvider} from '../apps/api/wallet-payout-provider.js';
import {dispatchWalletPayouts,runWalletPayoutDispatch,walletPayoutBackoff} from '../workers/courier-wallet-payouts.js';

const command={id:'command-id',claim_token:'claim-token',idempotency_key:'courier-withdrawal:0001',amount_cents:2500,payout_destination_reference:'provider-destination-1',attempts:1};

test('payout gateway receives only opaque destination, exact amount and idempotency',async()=>{let request;const provider=createWalletPayoutProvider({walletPayoutProviderUrl:'https://payout.example.test/v1/transfers',walletPayoutProviderSecret:'secret'},async(url,init)=>(request={url,init},{ok:true,json:async()=>({providerReference:'provider-transfer-1',status:'pending'})}));const result=await provider.transfer(command);assert.match(result.providerReferenceHash,/^[a-f0-9]{64}$/);assert.equal(request.init.headers['idempotency-key'],command.idempotency_key);assert.deepEqual(JSON.parse(request.init.body),{operation:'create-pix-transfer',amountCents:2500,destinationReference:'provider-destination-1'});assert.equal(JSON.stringify(request).includes('secret'),true);assert.equal(JSON.stringify(request).includes('cpf'),false);});

test('dispatch marks accepted commands and reschedules provider failures',async()=>{const marked=[],rescheduled=[];const commands=[command,{...command,id:'second',claim_token:'second-token',attempts:3}];const result=await dispatchWalletPayouts({repository:{claimProviderCommands:async()=>commands,markProviderPending:async input=>marked.push(input),rescheduleProviderCommand:async input=>rescheduled.push(input)},provider:{transfer:async item=>{if(item.id==='second')throw new Error('offline');return{providerReferenceHash:'a'.repeat(64)};}}});assert.deepEqual(result,{claimed:2,accepted:1,failed:1});assert.equal(marked[0].providerReferenceHash,'a'.repeat(64));assert.equal(rescheduled[0].retryAfterSeconds,120);assert.equal(walletPayoutBackoff(20),3600);});

test('eighth provider failure blocks the command for human resolution',async()=>{const blocked=[];await dispatchWalletPayouts({repository:{claimProviderCommands:async()=>[{...command,attempts:8}],blockProviderCommand:async input=>blocked.push(input)},provider:{transfer:async()=>{throw new Error('offline');}}});assert.deepEqual(blocked,[{commandId:'command-id',claimToken:'claim-token',failureCode:'provider_retry_exhausted'}]);});

test('production dispatch remains fail-closed without both activation flags',async()=>{for(const env of [{},{NODE_ENV:'production',COURIER_WALLET_PAYOUTS_ENABLED:'true'}])await assert.rejects(runWalletPayoutDispatch({env}),/ativação explícita/);});
