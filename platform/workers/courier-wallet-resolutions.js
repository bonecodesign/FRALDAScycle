import {createDatabase} from '../database/client.js';
import {createCourierWalletRepository} from '../database/courier-wallet-repository.js';
import {resolveRuntimeEnv} from '../apps/api/secrets.js';
import {isMainModule} from '../packages/contracts/main-module.js';

export async function executeAuthorizedWalletResolutions({repository,limit=20}){const rows=await repository.authorizedBlockedResolutions({limit}),results=[];for(const row of rows){try{results.push(await repository.executeAuthorizedResolution({resolutionId:row.id}));}catch(error){results.push({resolutionId:row.id,errorCode:error.code??'execution_failed'});}}return Object.freeze({found:rows.length,executed:results.filter(row=>!row.errorCode).length,failed:results.filter(row=>row.errorCode).length,results:Object.freeze(results)});}

export async function runWalletResolutionExecution({env=process.env,createDb=createDatabase,createRepository=createCourierWalletRepository,resolveEnv=resolveRuntimeEnv}={}){if(env.NODE_ENV!=='production'||env.COURIER_WALLET_RESOLUTION_EXECUTION_ENABLED!=='true'||env.COURIER_WALLET_RESOLUTION_EXECUTION_ACKNOWLEDGED!=='true')throw new Error('A execução de resoluções exige produção e ativação explícita reconhecida.');const runtimeEnv=await resolveEnv(env),database=createDb({databaseUrl:runtimeEnv.DATABASE_URL,databaseSsl:runtimeEnv.DATABASE_SSL!=='false'});try{const result=await executeAuthorizedWalletResolutions({repository:createRepository(database)});console.log(JSON.stringify({type:'courier-wallet.resolution-execution.completed',...result,results:undefined}));return result;}finally{await database.close();}}

if(isMainModule(import.meta.url))runWalletResolutionExecution().catch(error=>{console.error(error.message);process.exitCode=1;});
