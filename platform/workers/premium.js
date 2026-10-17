import { createDatabase } from '../database/client.js';
import { createPremiumRepository } from '../database/premium-repository.js';
import { isMainModule } from '../packages/contracts/main-module.js';

const LOCAL_HOSTS=new Set(['127.0.0.1','localhost','[::1]']);
const MIN_INTERVAL_MS=15*60*1000;
const MAX_INTERVAL_MS=24*60*60*1000;

function databaseUrl(value) {
  let url;
  try { url=new URL(value||'invalid:'); } catch { throw new Error('Informe uma conexão PostgreSQL válida.'); }
  if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('A rotina Premium exige PostgreSQL.');
  return url;
}

function interval(value) {
  const parsed=Number(value??MIN_INTERVAL_MS);
  if(!Number.isInteger(parsed)||parsed<MIN_INTERVAL_MS||parsed>MAX_INTERVAL_MS)throw new Error('PREMIUM_REGULARIZATION_INTERVAL_MS deve ficar entre 15 minutos e 24 horas.');
  return parsed;
}

function waitFor(ms,signal) {
  if(signal?.aborted)return Promise.resolve();
  return new Promise(resolve=>{const timer=setTimeout(done,ms);function done(){clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();}signal?.addEventListener('abort',done,{once:true});});
}

export async function runPremiumWorker({mode,env=process.env,createDb=createDatabase,createRepository=createPremiumRepository,wait=waitFor,signal}={}) {
  const url=databaseUrl(env.DATABASE_URL);
  if(mode==='once'&&!LOCAL_HOSTS.has(url.hostname))throw new Error('A execução manual aceita somente PostgreSQL local.');
  if(mode==='serve'&&(env.NODE_ENV!=='production'||env.PREMIUM_REGULARIZATION_ENABLED!=='true'))throw new Error('O worker periódico exige produção e PREMIUM_REGULARIZATION_ENABLED=true.');
  if(!['once','serve'].includes(mode))throw new Error('Use --once localmente ou --serve no serviço periódico.');
  const delay=mode==='serve'?interval(env.PREMIUM_REGULARIZATION_INTERVAL_MS):null;
  const database=createDb({databaseUrl:url.toString(),databaseSsl:env.DATABASE_SSL!=='false'});
  const repository=createRepository(database);
  try {
    do {
      const result=await repository.regularizeExpired();
      console.log(JSON.stringify({type:'premium.regularization.completed',...result}));
      if(mode==='once'||signal?.aborted)break;
      await wait(delay,signal);
    } while(!signal?.aborted);
  } finally { await database.close(); }
}

if(isMainModule(import.meta.url)){
  const argument=process.argv[2];
  const controller=new AbortController();
  process.once('SIGTERM',()=>controller.abort());process.once('SIGINT',()=>controller.abort());
  await runPremiumWorker({mode:argument==='--once'?'once':argument==='--serve'?'serve':argument,signal:controller.signal});
}
