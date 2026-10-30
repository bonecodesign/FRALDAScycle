import {createDatabase} from '../database/client.js';
import {createAsaasWebhookRepository} from '../database/asaas-webhook-repository.js';
import {createPremiumBillingRepository} from '../database/premium-billing-repository.js';
import {createPremiumBillingService} from '../apps/api/premium-billing-service.js';
import {createAsaasClient} from '../apps/api/asaas-client.js';
import {isMainModule} from '../packages/contracts/main-module.js';
import {cancelExpiredPremiumRenewals,reconcileAsaasInbox} from './asaas-reconciliation.js';
const wait=(ms,signal)=>new Promise(resolve=>{const timer=setTimeout(done,ms);function done(){clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();}signal?.addEventListener('abort',done,{once:true});});
export async function runAsaasPremiumReconciliation({mode,env=process.env,createDb=createDatabase,signal}={}){
  if(!['once','serve'].includes(mode))throw new Error('Use --once ou --serve.');
  const environment=env.ASAAS_ENVIRONMENT??'sandbox';
  if(mode==='serve'&&(env.NODE_ENV!=='production'||environment!=='production'||env.ASAAS_ACTIVATION_ACKNOWLEDGED!=='true'))throw new Error('O worker periódico exige produção e ativação Asaas reconhecida.');
  if(!env.DATABASE_URL||!env.ASAAS_API_KEY)throw new Error('DATABASE_URL e ASAAS_API_KEY são obrigatórios.');
  const database=createDb({databaseUrl:env.DATABASE_URL,databaseSsl:env.DATABASE_SSL!=='false'});
  const repository=createAsaasWebhookRepository(database),premiumBillingService=createPremiumBillingService(createPremiumBillingRepository(database));
  const client=createAsaasClient({enabled:true,apiKey:env.ASAAS_API_KEY,environment});
  try{do{const result=await reconcileAsaasInbox({repository,client,premiumBillingService});const expirations=await cancelExpiredPremiumRenewals({repository,client});console.log(JSON.stringify({type:'asaas.premium.reconciliation.completed',...result,expirations}));if(mode==='once'||signal?.aborted)break;await wait(60_000,signal);}while(!signal?.aborted);}finally{await database.close();}
}
if(isMainModule(import.meta.url)){const controller=new AbortController();process.once('SIGTERM',()=>controller.abort());process.once('SIGINT',()=>controller.abort());await runAsaasPremiumReconciliation({mode:process.argv[2]==='--once'?'once':process.argv[2]==='--serve'?'serve':process.argv[2],signal:controller.signal});}
