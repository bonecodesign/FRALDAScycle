import {createDatabase} from '../database/client.js';
import {createExchangeReconciliationRetentionRepository} from '../database/exchange-reconciliation-retention-repository.js';
import {isMainModule} from '../packages/contracts/main-module.js';

const LOCAL_HOSTS=new Set(['127.0.0.1','localhost','[::1]']);
const waitFor=(ms,signal)=>signal?.aborted?Promise.resolve():new Promise(resolve=>{const timer=setTimeout(done,ms);function done(){clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();}signal?.addEventListener('abort',done,{once:true});});

export function millisecondsUntilDailyRetention(now=new Date()){
 const current=new Date(now);if(Number.isNaN(current.getTime()))throw new Error('Instante de agendamento inválido.');
 const next=new Date(current);next.setUTCHours(6,30,0,0);if(next<=current)next.setUTCDate(next.getUTCDate()+1);return next.getTime()-current.getTime();
}

export async function anonymizeExpiredExchangeReconciliations(repository,{limit=100}={}){return repository.anonymizeDue({limit});}

export async function runExchangeReconciliationRetention({mode,env=process.env,createDb=createDatabase,createRepository=createExchangeReconciliationRetentionRepository,wait=waitFor,clock=()=>new Date(),signal}={}){
 if(!['once','serve'].includes(mode))throw new Error('Use --once localmente ou --serve no serviço diário.');
 let url;try{url=new URL(env.DATABASE_URL||'invalid:');}catch{throw new Error('Informe uma conexão PostgreSQL válida.');}
 if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('A retenção exige PostgreSQL.');
 if(mode==='once'&&!LOCAL_HOSTS.has(url.hostname))throw new Error('A execução manual aceita somente PostgreSQL local.');
 if(mode==='serve'&&(env.NODE_ENV!=='production'||env.EXCHANGE_RECONCILIATION_RETENTION_ENABLED!=='true'||env.EXCHANGE_RECONCILIATION_RETENTION_LEGAL_ACKNOWLEDGED!=='true'))throw new Error('A anonimização diária exige produção, feature flag e aprovação jurídica/privacidade reconhecida.');
 const database=createDb({databaseUrl:url.toString(),databaseSsl:env.DATABASE_SSL!=='false'}),repository=createRepository(database);
 try{
  if(mode==='once')return await anonymizeExpiredExchangeReconciliations(repository);
  while(!signal?.aborted){await wait(millisecondsUntilDailyRetention(clock()),signal);if(signal?.aborted)break;const result=await anonymizeExpiredExchangeReconciliations(repository);console.log(JSON.stringify({type:'exchange.reconciliation.retention.completed',scheduledUtc:'06:30',...result}));}
  return{stopped:true};
 }finally{await database.close();}
}

if(isMainModule(import.meta.url)){const argument=process.argv[2],controller=new AbortController();process.once('SIGTERM',()=>controller.abort());process.once('SIGINT',()=>controller.abort());await runExchangeReconciliationRetention({mode:argument==='--once'?'once':argument==='--serve'?'serve':argument,signal:controller.signal});}

