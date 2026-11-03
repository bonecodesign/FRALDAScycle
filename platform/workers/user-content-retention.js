import {isMainModule} from '../packages/contracts/main-module.js';
import {createDatabase} from '../database/client.js';
import {createUserContentRetentionRepository} from '../database/user-content-retention-repository.js';
const DAY_MS=24*60*60*1000;
export async function runUserContentRetention({mode='once',env=process.env,createDb=createDatabase,createRepository=createUserContentRetentionRepository,wait=(ms,signal)=>new Promise(resolve=>{const timer=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(timer);resolve();},{once:true});}),signal}={}){
 if(env.USER_CONTENT_RETENTION_ENABLED!=='true'||env.USER_CONTENT_RETENTION_MAINTENANCE_ENABLED!=='true')return{enabled:false};
 if(env.NODE_ENV==='production'&&env.USER_CONTENT_RETENTION_ACTIVATION_ACKNOWLEDGED!=='true')throw new Error('USER_CONTENT_RETENTION_ACTIVATION_ACKNOWLEDGED=true is required in production');
 const database=createDb({databaseUrl:env.DATABASE_URL,databaseSsl:env.DATABASE_SSL==='true'}),repository=createRepository(database);try{let result;do{const expired=await repository.expire(100),prepared=await repository.prepareStorageActions(100);result={enabled:true,...expired,...prepared};console.log(JSON.stringify({type:'user-content.retention.completed',...result}));if(mode==='once'||signal?.aborted)break;await wait(DAY_MS,signal);}while(!signal?.aborted);return result;}finally{await database.close();}
}
if(isMainModule(import.meta.url)){const controller=new AbortController();for(const event of['SIGTERM','SIGINT'])process.once(event,()=>controller.abort());runUserContentRetention({mode:'serve',signal:controller.signal}).catch(error=>{console.error(JSON.stringify({type:'user-content.retention.failed',code:String(error?.code??'retention_failed').slice(0,80)}));process.exitCode=1;});}
