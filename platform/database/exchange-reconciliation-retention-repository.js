export function createExchangeReconciliationRetentionRepository(database){return Object.freeze({
 async anonymizeDue({limit=100}={}){if(!Number.isSafeInteger(limit)||limit<1||limit>500)throw new Error('Limite de retenção inválido.');return database.transaction(async client=>{
  const due=(await client.query(`SELECT id FROM exchange_settlement_reconciliation_closures WHERE anonymized_at IS NULL AND retention_due_at<=now() ORDER BY retention_due_at,id FOR UPDATE SKIP LOCKED LIMIT $1`,[limit])).rows;
  if(due.length===0)return{anonymized:0};
  const ids=due.map(row=>row.id);
  await client.query(`DELETE FROM exchange_settlement_reconciliation_alerts WHERE resolution_closure_id=ANY($1::uuid[])`,[ids]);
  const result=await client.query(`UPDATE exchange_settlement_reconciliation_closures SET confirmation_month=date_trunc('month',confirmed_at)::date,command_id=NULL,recovery_command_id=NULL,evidence_sha256=NULL,confirmed_at=NULL,anonymized_at=now() WHERE id=ANY($1::uuid[]) AND anonymized_at IS NULL RETURNING id`,[ids]);
  await client.query(`INSERT INTO audit_events(action,entity_type,entity_id,metadata) VALUES('exchange.reconciliation.retention_anonymized','retention_batch','exchange-reconciliation-5y',$1::jsonb)`,[JSON.stringify({retentionYears:5,anonymized:result.rows.length,personalIdentifiersRetained:false})]);
  return{anonymized:result.rows.length};
 });}
});}

