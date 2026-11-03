import {createDatabase} from '../database/client.js';
import {createChildProfileResponsibilityRepository} from '../database/child-profile-responsibility-repository.js';
import {isMainModule} from '../packages/contracts/main-module.js';
const LOCAL_HOSTS=new Set(['127.0.0.1','localhost','[::1]']);
const waitFor=(ms,signal)=>new Promise(resolve=>{if(signal?.aborted)return resolve();const timer=setTimeout(done,ms);function done(){clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();}signal?.addEventListener('abort',done,{once:true});});
export async function runChildProfileResponsibilityRetention({mode,env=process.env,createDb=createDatabase,createRepository=createChildProfileResponsibilityRepository,wait=waitFor,signal}={}){
 let url;try{url=new URL(env.DATABASE_URL||'invalid:');}catch{throw new Error('Informe uma conexão PostgreSQL válida.');}
 if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('A retenção exige PostgreSQL.');
 if(mode==='once'&&!LOCAL_HOSTS.has(url.hostname))throw new Error('A execução manual aceita somente PostgreSQL local.');
 if(mode==='serve'&&(env.NODE_ENV!=='production'||env.FAMILY_RESPONSIBILITY_RETENTION_ENABLED!=='true'||env.FAMILY_RESPONSIBILITY_DISPUTES_ENABLED!=='true'))throw new Error('O worker periódico exige produção e os gates de disputa e retenção.');
 if(!['once','serve'].includes(mode))throw new Error('Use --once localmente ou --serve no serviço periódico.');
 const database=createDb({databaseUrl:url.toString(),databaseSsl:env.DATABASE_SSL!=='false'}),repository=createRepository(database);
 try{do{const result=await repository.purgeExpiredEvidence(100);console.log(JSON.stringify({type:'child-profile.responsibility-retention.completed',...result}));if(mode==='once'||signal?.aborted)break;await wait(24*60*60*1000,signal);}while(!signal?.aborted);}finally{await database.close();}
}
if(isMainModule(import.meta.url)){const argument=process.argv[2],controller=new AbortController();process.once('SIGTERM',()=>controller.abort());process.once('SIGINT',()=>controller.abort());await runChildProfileResponsibilityRetention({mode:argument==='--once'?'once':argument==='--serve'?'serve':argument,signal:controller.signal});}
