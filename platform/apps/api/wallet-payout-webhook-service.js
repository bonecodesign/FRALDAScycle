import {createHash} from 'node:crypto';
import {verifyWebhookSignature} from './webhook-signature.js';

function invalid(code,status,message){return Object.assign(new Error(message),{code,status});}

export function createWalletPayoutWebhookService(repository,{secret,now=Date.now}={}){return Object.freeze({
  async receive({raw,timestamp,signature}){
    if(!secret)throw invalid('wallet_payout_webhook_not_configured',503,'Webhook de saques não configurado.');
    verifyWebhookSignature({raw,timestamp,signature,now},secret,kind=>invalid(`invalid_wallet_payout_webhook_${kind}`,401,'Webhook de saques inválido.'));
    let payload;try{payload=JSON.parse(raw.toString('utf8'));}catch{throw invalid('invalid_wallet_payout_webhook_payload',400,'Payload inválido.');}
    if(typeof payload?.id!=='string'||payload.id.length<8||payload.id.length>300||typeof payload?.providerReference!=='string'||payload.providerReference.length<8||payload.providerReference.length>300||!['completed','failed'].includes(payload.status)||payload.amountCents!==undefined)throw invalid('invalid_wallet_payout_webhook_payload',422,'Evento de saque inválido.');
    if(payload.status==='failed'&&!/^[a-z0-9_.-]{3,100}$/i.test(payload.failureCode??''))throw invalid('invalid_wallet_payout_webhook_payload',422,'Falha terminal inválida.');
    const providerReferenceHash=createHash('sha256').update(payload.providerReference).digest('hex');
    const eventHash=createHash('sha256').update(payload.id).digest('hex');
    return repository.reconcileProviderEvent({providerReferenceHash,status:payload.status,failureCode:payload.failureCode??null,evidenceSha256:createHash('sha256').update(raw).digest('hex'),idempotencyKey:`wallet-webhook:${eventHash}`});
  },
});}
