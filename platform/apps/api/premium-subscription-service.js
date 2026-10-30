import { createHash,randomUUID } from 'node:crypto';
import { verifyBillingCpf } from '../../packages/contracts/payment-billing-identity.js';
import { PREMIUM_MONTHLY_CENTS } from '../../packages/contracts/premium-rules.js';
const RAW=new Set(['cardNumber','cvv','pan','securityCode','expiry','expires']);
const fail=(code,status,message)=>Object.assign(new Error(message),{code,status});
export function createPremiumSubscriptionService(repository,client,{cpfHmacSecret,clock=Date.now}={}){return Object.freeze({
  async subscribe(userId,input){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>RAW.has(k)))throw fail('raw_card_data_forbidden',422,'Dados brutos de cartão não são aceitos.');
    if(Object.keys(input).some(k=>!['paymentMethodToken','billingCpf','idempotencyKey'].includes(k)))throw fail('invalid_premium_subscription',422,'Dados da assinatura inválidos.');
    const token=String(input.paymentMethodToken??'').trim(),key=String(input.idempotencyKey??'').trim();
    if(token.length<8||token.length>512)throw fail('payment_token_required',422,'Tokenize o cartão antes de continuar.');
    if(!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw fail('invalid_idempotency_key',422,'Chave de idempotência inválida.');
    const previous=await repository.retryContext?.(userId);
    if(previous){await client.cancelSubscription(previous.provider_subscription_id);const closed=await repository.cancelled({userId,id:previous.id,allowPaymentFailed:true});if(!closed)throw fail('premium_subscription_state_conflict',409,'A assinatura mudou durante a nova tentativa. Atualize a tela.');}
    const localReference=`premium:${randomUUID()}`;
    const reserved=await repository.reserve({userId,idempotencyKey:key,localReference});
    if(reserved.reused)return{reused:true,status:reserved.subscription.status,benefitsActivatedByRequest:false};
    try{
      const cpf=verifyBillingCpf(input.billingCpf,reserved.account.cpf_fingerprint,cpfHmacSecret);
      const scoped=scope=>createHash('sha256').update(`${scope}:${key}`).digest('hex');
      const customer=await client.createCustomer({reference:`premium-customer:${userId}`,name:reserved.account.legal_name,billingCpf:cpf,billingEmail:reserved.account.email,idempotencyKey:scoped('customer')});
      const nextDueDate=new Date(clock()).toISOString().slice(0,10);
      const remote=await client.createCreditCardSubscription({customerId:customer.customerId,reference:localReference,amountCents:PREMIUM_MONTHLY_CENTS,nextDueDate,description:'FraldaCycle Premium mensal',creditCardToken:token,idempotencyKey:scoped('subscription')});
      await repository.attach({id:reserved.subscription.id,customerId:customer.customerId,subscriptionId:remote.subscriptionId});
      return{reused:false,status:'provider_pending',benefitsActivatedByRequest:false};
    }catch(error){await repository.fail({id:reserved.subscription.id,failureCode:error.code??'provider_error'});throw error;}
  },
  async cancelRenewal(userId,input){if(input?.confirmed!==true||Object.keys(input??{}).some(k=>k!=='confirmed'))throw fail('premium_confirmation_required',422,'Confirme o cancelamento da próxima renovação.');const current=await repository.cancelContext(userId);if(!current)return{reused:true,cancelled:true};await client.cancelSubscription(current.provider_subscription_id);await repository.cancelled({userId,id:current.id});return{reused:false,cancelled:true};},
});}
