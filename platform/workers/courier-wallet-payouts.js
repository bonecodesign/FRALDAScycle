import {createDatabase} from '../database/client.js';
import {createCourierWalletRepository} from '../database/courier-wallet-repository.js';
import {createWalletPayoutProvider} from '../apps/api/wallet-payout-provider.js';
import {resolveRuntimeEnv} from '../apps/api/secrets.js';
import {isMainModule} from '../packages/contracts/main-module.js';

export function walletPayoutBackoff(attempt){return Math.min(3600,30*(2**Math.max(0,attempt-1)));}

export async function dispatchWalletPayouts({repository,provider,limit=20}){
  const commands=await repository.claimProviderCommands({limit});let accepted=0,failed=0;
  for(const command of commands){try{const result=await provider.transfer(command);await repository.markProviderPending({commandId:command.id,claimToken:command.claim_token,providerReferenceHash:result.providerReferenceHash});accepted++;}catch{try{if(command.attempts>=8)await repository.blockProviderCommand({commandId:command.id,claimToken:command.claim_token,failureCode:'provider_retry_exhausted'});else await repository.rescheduleProviderCommand({commandId:command.id,claimToken:command.claim_token,failureCode:'provider_unavailable',retryAfterSeconds:walletPayoutBackoff(command.attempts)});}catch{}failed++;}}
  return Object.freeze({claimed:commands.length,accepted,failed});
}

export async function runWalletPayoutDispatch({env=process.env,createDb=createDatabase,createRepository=createCourierWalletRepository,createProvider=createWalletPayoutProvider,resolveEnv=resolveRuntimeEnv}={}){
  if(env.NODE_ENV!=='production'||env.COURIER_WALLET_PAYOUTS_ENABLED!=='true'||env.COURIER_WALLET_PAYOUTS_ACTIVATION_ACKNOWLEDGED!=='true')throw new Error('O envio de saques exige produção e ativação explícita reconhecida.');
  const runtimeEnv=await resolveEnv(env);
  const database=createDb({databaseUrl:runtimeEnv.DATABASE_URL,databaseSsl:runtimeEnv.DATABASE_SSL!=='false'}),repository=createRepository(database),provider=createProvider({walletPayoutProviderUrl:runtimeEnv.WALLET_PAYOUT_PROVIDER_URL,walletPayoutProviderSecret:runtimeEnv.WALLET_PAYOUT_PROVIDER_SECRET});
  try{const result=await dispatchWalletPayouts({repository,provider});console.log(JSON.stringify({type:'courier-wallet.payout-dispatch.completed',...result}));return result;}finally{await database.close();}
}

if(isMainModule(import.meta.url))runWalletPayoutDispatch().catch(error=>{console.error(error.message);process.exitCode=1;});
