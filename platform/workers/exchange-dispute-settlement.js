import {createDatabase} from '../database/client.js';
import {createExchangeRepository} from '../database/exchange-repository.js';
import {isMainModule} from '../packages/contracts/main-module.js';

export async function processExchangeDisputeSettlements({repository,executor,limit=20}) {
  if(typeof executor!=='function')throw new Error('Configure o adaptador financeiro homologado.');
  const commands=await repository.claimDifferenceDisputeSettlements({limit});let completed=0,reconciliationRequired=0;
  for(const command of commands){try{const result=await executor({operation:command.operation,transactionId:command.transaction_id,idempotencyKey:command.idempotency_key});await repository.completeDifferenceDisputeSettlement({commandId:command.id,providerReference:result.providerReference});completed++;}catch(error){await repository.requireDifferenceDisputeSettlementReconciliation({commandId:command.id,failureCode:String(error?.code??'provider_uncertain').toLowerCase().replace(/[^a-z0-9_:-]/g,'_').slice(0,80)});reconciliationRequired++;}}
  return Object.freeze({claimed:commands.length,completed,reconciliationRequired});
}

export async function runExchangeDisputeSettlement({env=process.env,createDb=createDatabase,createRepository=createExchangeRepository,executor}={}){
  if(env.NODE_ENV!=='production'||env.EXCHANGE_DISPUTE_SETTLEMENT_ENABLED!=='true'||env.EXCHANGE_DISPUTE_SETTLEMENT_ACTIVATION_ACKNOWLEDGED!=='true')throw new Error('O worker exige produção, feature flag e ativação formal reconhecida.');
  if(typeof executor!=='function')throw new Error('Configure o adaptador financeiro homologado.');
  const database=createDb({databaseUrl:env.DATABASE_URL,databaseSsl:env.DATABASE_SSL!=='false'}),repository=createRepository(database);try{return await processExchangeDisputeSettlements({repository,executor});}finally{await database.close();}
}

if(isMainModule(import.meta.url))await runExchangeDisputeSettlement();
