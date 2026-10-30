import {createDatabase} from '../database/client.js';
import {createPaymentRepository} from '../database/payment-repository.js';
import {createPaymentProvider} from '../apps/api/payment-provider.js';
import {isMainModule} from '../packages/contracts/main-module.js';
import {monitorSupportedRefunds} from './supported-refund-monitoring.js';

export async function reconcileSupportedRefunds({repository,provider,limit=20}){
  const items=await repository.pendingSupportedRefunds(limit);let completed=0,pending=0,blocked=0;
  for(const item of items){try{const remote=await provider.refundStatus({providerCaseReference:item.provider_case_reference});const result=await repository.reconcileSupportedRefund({cancellationId:item.id,providerCaseReference:remote.providerCaseReference,status:remote.status,amountCents:remote.amountCents});if(result.completed)completed++;else if(result.blocked)blocked++;else if(result.matched)pending++;else blocked++;}catch{blocked++;}}
  return Object.freeze({checked:items.length,completed,pending,blocked});
}

const waitFor=(ms,signal)=>signal?.aborted?Promise.resolve():new Promise(resolve=>{const timer=setTimeout(done,ms);function done(){clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();}signal?.addEventListener('abort',done,{once:true});});
export async function runSupportedRefundReconciliation({env=process.env,createDb=createDatabase,createRepository=createPaymentRepository,createProvider=createPaymentProvider,wait=waitFor,signal}={}){
  if(env.NODE_ENV!=='production'||env.REFUND_RECONCILIATION_ENABLED!=='true')throw new Error('A reconciliação periódica exige produção e REFUND_RECONCILIATION_ENABLED=true.');
  const interval=Number(env.REFUND_RECONCILIATION_INTERVAL_MS??900000);if(!Number.isInteger(interval)||interval<300000||interval>86400000)throw new Error('REFUND_RECONCILIATION_INTERVAL_MS deve ficar entre 5 minutos e 24 horas.');
  const database=createDb({databaseUrl:env.DATABASE_URL,databaseSsl:env.DATABASE_SSL!=='false'}),repository=createRepository(database),provider=createProvider({paymentProviderUrl:env.PAYMENT_PROVIDER_URL,paymentProviderSecret:env.PAYMENT_PROVIDER_SECRET});
  const thresholdMinutes=Number(env.REFUND_CONFIRMATION_ALERT_MINUTES??120);
  try{do{const reconciliation=await reconcileSupportedRefunds({repository,provider}),monitoring=await monitorSupportedRefunds({repository,thresholdMinutes});console.log(JSON.stringify({type:'refund.reconciliation.completed',reconciliation,monitoring}));if(signal?.aborted)break;await wait(interval,signal);}while(!signal?.aborted);}finally{await database.close();}
}

if(isMainModule(import.meta.url)){const controller=new AbortController();process.once('SIGTERM',()=>controller.abort());process.once('SIGINT',()=>controller.abort());await runSupportedRefundReconciliation({signal:controller.signal});}
