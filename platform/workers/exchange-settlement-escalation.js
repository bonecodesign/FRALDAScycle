export async function escalateExchangeSettlementReconciliations(repository,{limit=50}={}){return repository.escalateOverdueSettlementReconciliations({limit});}
