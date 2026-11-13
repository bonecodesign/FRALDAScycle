import {createHash} from 'node:crypto';

function endpoint(value){let parsed;try{parsed=new URL(value);}catch{throw new Error('Wallet payout provider URL is invalid');}if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash)throw new Error('Wallet payout provider URL must be HTTPS without credentials or query');return parsed.toString();}
function validCommand(command){return command&&typeof command.idempotency_key==='string'&&command.idempotency_key.length>=16&&command.idempotency_key.length<=128&&Number.isInteger(command.amount_cents)&&command.amount_cents>=2000&&typeof command.payout_destination_reference==='string'&&command.payout_destination_reference.length>=8&&command.payout_destination_reference.length<=300;}

export function createWalletPayoutProvider(config,fetchImpl=fetch){
  const url=config?.walletPayoutProviderUrl,secret=config?.walletPayoutProviderSecret;
  return Object.freeze({
    async transfer(command){
      if(!url||!secret)throw new Error('Wallet payout provider is not configured');
      if(!validCommand(command))throw new Error('Wallet payout command is invalid');
      let response;try{response=await fetchImpl(endpoint(url),{method:'POST',redirect:'error',headers:{'content-type':'application/json',authorization:`Bearer ${secret}`,'idempotency-key':command.idempotency_key},body:JSON.stringify({operation:'create-pix-transfer',amountCents:command.amount_cents,destinationReference:command.payout_destination_reference}),signal:AbortSignal.timeout(10000)});}catch{throw new Error('Wallet payout provider is unavailable');}
      if(!response.ok)throw new Error(`Wallet payout provider returned ${response.status}`);
      let result;try{result=await response.json();}catch{throw new Error('Wallet payout provider response is invalid');}
      if(typeof result?.providerReference!=='string'||result.providerReference.length<8||result.providerReference.length>300||!['pending','accepted'].includes(result.status))throw new Error('Wallet payout provider response is invalid');
      return Object.freeze({providerReferenceHash:createHash('sha256').update(result.providerReference).digest('hex')});
    },
  });
}
