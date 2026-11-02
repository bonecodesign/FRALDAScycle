import {createDatabase} from '../database/client.js';
import {createExchangeReconciliationRetentionRepository} from '../database/exchange-reconciliation-retention-repository.js';
import {isMainModule} from '../packages/contracts/main-module.js';

export async function anonymizeExpiredExchangeReconciliations(repository,{limit=100}={}){return repository.anonymizeDue({limit});}

export async function runExchangeReconciliationRetention({env=process.env,createDb=createDatabase,createRepository=createExchangeReconciliationRetentionRepository}={}){
 if(env.NODE_ENV!=='production'||env.EXCHANGE_RECONCILIATION_RETENTION_ENABLED!=='true'||env.EXCHANGE_RECONCILIATION_RETENTION_LEGAL_ACKNOWLEDGED!=='true')throw new Error('A anonimização exige produção, feature flag e aprovação jurídica/privacidade reconhecida.');
 const database=createDb({databaseUrl:env.DATABASE_URL,databaseSsl:env.DATABASE_SSL!=='false'}),repository=createRepository(database);
 try{return await anonymizeExpiredExchangeReconciliations(repository);}finally{await database.close();}
}

if(isMainModule(import.meta.url))await runExchangeReconciliationRetention();

