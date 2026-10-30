import { reconcileAsaasPayment } from '../packages/contracts/asaas-payment-reconciliation.js';

function paidPeriod(dueDate){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate??'')))throw Object.assign(new Error('invalid_due_date'),{code:'provider_due_date_invalid'});
  const start=new Date(`${dueDate}T00:00:00.000Z`),end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1);
  return{start:start.toISOString(),end:end.toISOString()};
}

export async function reconcileAsaasInbox({repository,client,premiumBillingService=null,limit=20}){
  const recovered=await repository.recover(),items=await repository.acquire(limit);
  let reconciled=0,blocked=0,financialTransitions=0;
  for(const item of items){
    try{
      const providerPayment=await client.getPayment(item.payment_id);
      let expected=item.intent_id?{reference:item.reference,amountCents:item.amount_cents}:null,subscription=null;
      if(!expected&&providerPayment.subscriptionId){
        subscription=await repository.subscriptionContext(providerPayment.subscriptionId);
        expected=subscription?{reference:subscription.local_reference,amountCents:subscription.amount_cents}:null;
      }
      if(!expected){
        await repository.finish({eventId:item.event_id,status:'blocked',evidence:{paymentId:item.payment_id,blockers:['local_payment_not_found'],financialTransitionAllowed:false},failureCode:'local_payment_not_found'});
        blocked++;continue;
      }
      let evidence=reconcileAsaasPayment({expected,providerPayment});
      if(subscription&&evidence.candidateStatus==='paid'){
        if(!premiumBillingService)throw Object.assign(new Error('premium_billing_not_configured'),{code:'premium_billing_not_configured'});
        const period=paidPeriod(providerPayment.dueDate);
        await premiumBillingService.applyReconciled({userId:subscription.user_id,provider:'asaas',providerReference:providerPayment.paymentId,eventType:'period_paid',amountCents:subscription.amount_cents,paidPeriodStart:period.start,paidPeriodEnd:period.end,providerCheckedAt:evidence.checkedAt,evidenceSha256:item.payload_sha256});
        await repository.activateSubscription(subscription.id);financialTransitions++;
      }else if(subscription&&evidence.candidateStatus==='overdue'&&['active','renewal_failed'].includes(subscription.status)){
        if(!premiumBillingService)throw Object.assign(new Error('premium_billing_not_configured'),{code:'premium_billing_not_configured'});
        await premiumBillingService.applyReconciled({userId:subscription.user_id,provider:'asaas',providerReference:providerPayment.paymentId,eventType:'renewal_failed',amountCents:null,paidPeriodStart:null,paidPeriodEnd:null,providerCheckedAt:evidence.checkedAt,evidenceSha256:item.payload_sha256});
        await repository.failSubscriptionRenewal(subscription.id);financialTransitions++;
      }else if(subscription&&evidence.candidateStatus!=='paid'){
        if(['overdue','refunded','chargeback_pending'].includes(evidence.candidateStatus))await repository.failSubscriptionPayment(subscription.id);
        evidence={...evidence,matched:false,blockers:[...evidence.blockers,'premium_payment_not_paid']};
      }
      const status=evidence.matched?'reconciled':'blocked';
      await repository.finish({eventId:item.event_id,status,evidence,failureCode:evidence.matched?null:evidence.blockers.join(',')});
      if(evidence.matched)reconciled++;else blocked++;
    }catch(error){
      await repository.finish({eventId:item.event_id,status:'blocked',evidence:{paymentId:item.payment_id,blockers:['provider_reconciliation_failed'],financialTransitionAllowed:false},failureCode:error.code??'provider_reconciliation_failed'});blocked++;
    }
  }
  return Object.freeze({recovered,checked:items.length,reconciled,blocked,financialTransitions});
}

export async function cancelExpiredPremiumRenewals({repository,client,limit=20}){
  const items=await repository.acquireExpiredRenewals(limit);let cancelled=0,failed=0;
  for(const item of items){try{await client.cancelSubscription(item.provider_subscription_id);await repository.finishExpiredCancellation({id:item.id,userId:item.user_id,succeeded:true});cancelled++;}catch(error){await repository.finishExpiredCancellation({id:item.id,userId:item.user_id,succeeded:false,failureCode:error.code??'provider_error'});failed++;}}
  return Object.freeze({checked:items.length,cancelled,failed,automaticChargeRetries:0});
}
