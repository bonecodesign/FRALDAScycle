import {createHash} from 'node:crypto';

function fail(code,status,message){return Object.assign(new Error(message),{code,status});}

async function account(client,courierId){
  await client.query(`INSERT INTO courier_wallet_accounts(courier_id)
    SELECT id FROM users WHERE id=$1 AND role='courier' ON CONFLICT DO NOTHING`,[courierId]);
  return (await client.query('SELECT * FROM courier_wallet_accounts WHERE courier_id=$1 FOR UPDATE',[courierId])).rows[0];
}

async function ledger(client,{courierId,kind,amountCents,sourceType,sourceId,providerReferenceHash=null,evidenceSha256=null,idempotencyKey}){
  const balance=(await client.query('SELECT available_cents,reserved_cents FROM courier_wallet_accounts WHERE courier_id=$1',[courierId])).rows[0];
  return (await client.query(`INSERT INTO courier_wallet_entries
    (courier_id,kind,amount_cents,available_after_cents,reserved_after_cents,source_type,source_id,provider_reference_hash,evidence_sha256,idempotency_key)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [courierId,kind,amountCents,balance.available_cents,balance.reserved_cents,sourceType,sourceId,providerReferenceHash,evidenceSha256,idempotencyKey])).rows[0];
}

export function createCourierWalletRepository(database){return Object.freeze({
  async creditConfirmedPayout({courierId,payoutId,amountCents,providerReferenceHash,evidenceSha256,idempotencyKey}){
    if(!Number.isInteger(amountCents)||amountCents<=0||typeof idempotencyKey!=='string'||idempotencyKey.length<16||idempotencyKey.length>128||!/^([0-9a-f]{64})$/.test(providerReferenceHash)||!/^([0-9a-f]{64})$/.test(evidenceSha256))throw fail('invalid_wallet_credit',422,'Crédito confirmado inválido.');
    return database.transaction(async client=>{
      const current=await account(client,courierId);if(!current)throw fail('courier_not_found',404,'Entregador não encontrado.');
      const existing=(await client.query('SELECT * FROM courier_wallet_entries WHERE idempotency_key=$1',[idempotencyKey])).rows[0];
      if(existing){if(existing.courier_id!==courierId||existing.source_id!==payoutId||existing.amount_cents!==amountCents)throw fail('wallet_idempotency_conflict',409,'Chave já utilizada em outro lançamento.');return{entry:existing,reused:true};}
      await client.query('UPDATE courier_wallet_accounts SET available_cents=available_cents+$2,version=version+1,updated_at=now() WHERE courier_id=$1',[courierId,amountCents]);
      const entry=await ledger(client,{courierId,kind:'delivery_credit',amountCents,sourceType:'courier_payout',sourceId:payoutId,providerReferenceHash,evidenceSha256,idempotencyKey});
      await client.query(`INSERT INTO audit_events(action,entity_type,entity_id,metadata) VALUES('courier.wallet.credited','courier_wallet_entry',$1,$2::jsonb)`,[entry.id,JSON.stringify({amountCents,providerReconciled:true})]);
      return{entry,reused:false};
    });
  },
  async requestWithdrawal({courierId,amountCents,idempotencyKey,now=new Date()}){
    if(!Number.isInteger(amountCents)||amountCents<2000||typeof idempotencyKey!=='string'||idempotencyKey.length<16||idempotencyKey.length>128||!(now instanceof Date)||Number.isNaN(now.getTime()))throw fail('withdrawal_minimum',422,'O saque mínimo é R$ 20,00.');
    return database.transaction(async client=>{
      const current=await account(client,courierId);if(!current)throw fail('courier_not_found',404,'Entregador não encontrado.');
      const existing=(await client.query('SELECT * FROM courier_wallet_withdrawals WHERE idempotency_key=$1',[idempotencyKey])).rows[0];
      if(existing){if(existing.courier_id!==courierId||existing.amount_cents!==amountCents)throw fail('wallet_idempotency_conflict',409,'Chave já utilizada em outra solicitação.');return{withdrawal:existing,reused:true};}
      const profile=(await client.query(`SELECT payout_provider_reference,payout_status FROM courier_profiles WHERE user_id=$1 FOR SHARE`,[courierId])).rows[0];
      if(profile?.payout_status!=='verified'||!profile.payout_provider_reference)throw fail('payout_destination_unverified',409,'Confirme uma conta PIX do mesmo CPF antes do saque.');
      const recent=(await client.query(`SELECT id FROM courier_wallet_withdrawals WHERE courier_id=$1 AND requested_at>$2::timestamptz-interval '7 days' LIMIT 1`,[courierId,now.toISOString()])).rows[0];
      if(recent)throw fail('withdrawal_weekly_limit',409,'Já existe uma solicitação de saque nos últimos sete dias.');
      if(current.available_cents<amountCents)throw fail('wallet_insufficient_balance',409,'Saldo disponível insuficiente.');
      const withdrawal=(await client.query(`INSERT INTO courier_wallet_withdrawals(courier_id,amount_cents,payout_destination_reference,idempotency_key,requested_at)
        VALUES($1,$2,$3,$4,$5) RETURNING *`,[courierId,amountCents,profile.payout_provider_reference,idempotencyKey,now.toISOString()])).rows[0];
      await client.query('UPDATE courier_wallet_accounts SET available_cents=available_cents-$2,reserved_cents=reserved_cents+$2,version=version+1,updated_at=now() WHERE courier_id=$1',[courierId,amountCents]);
      const reserveKey=createHash('sha256').update(`reserve:${idempotencyKey}`).digest('hex');
      await ledger(client,{courierId,kind:'withdrawal_reserve',amountCents,sourceType:'pix_withdrawal',sourceId:withdrawal.id,idempotencyKey:reserveKey});
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'courier.wallet.withdrawal_requested','courier_wallet_withdrawal',$2,$3::jsonb)`,[courierId,withdrawal.id,JSON.stringify({amountCents,providerCalled:false})]);
      return{withdrawal,reused:false};
    });
  },
  async advanceWithdrawal({withdrawalId,actorId,accessLevel,note}){
    const stages={requested:{level:3,next:'level3_proposed',column:'proposed'},level3_proposed:{level:4,next:'level4_approved',column:'approved'},level4_approved:{level:5,next:'level5_authorized',column:'authorized'}};
    return database.transaction(async client=>{
      const row=(await client.query('SELECT * FROM courier_wallet_withdrawals WHERE id=$1 FOR UPDATE',[withdrawalId])).rows[0];if(!row)throw fail('withdrawal_not_found',404,'Solicitação não encontrada.');
      const stage=stages[row.status];if(!stage||accessLevel!==stage.level)throw fail('withdrawal_stage_forbidden',403,'Esta etapa exige o nível de acesso correspondente.');
      const actor=(await client.query('SELECT staff_access_level FROM users WHERE id=$1 AND disabled_at IS NULL FOR SHARE',[actorId])).rows[0];
      if(Number(actor?.staff_access_level)!==stage.level)throw fail('withdrawal_stage_forbidden',403,'O nível interno ativo não corresponde a esta etapa.');
      if([row.proposed_by,row.approved_by,row.authorized_by].includes(actorId))throw fail('withdrawal_independent_reviewer_required',403,'Cada etapa exige uma pessoa diferente.');
      if(typeof note!=='string'||note.trim().length<10||note.trim().length>1000)throw fail('withdrawal_note_required',422,'Registre uma justificativa auditável.');
      const updated=(await client.query(`UPDATE courier_wallet_withdrawals SET status=$2,${stage.column}_by=$3,${stage.column}_at=now(),updated_at=now() WHERE id=$1 RETURNING *`,[withdrawalId,stage.next,actorId])).rows[0];
      if(stage.next==='level5_authorized')await client.query(`INSERT INTO courier_wallet_provider_commands(withdrawal_id,idempotency_key)
        VALUES($1,$2) ON CONFLICT(withdrawal_id) DO NOTHING`,[withdrawalId,`courier-withdrawal:${withdrawalId}`]);
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'courier.wallet.withdrawal_advanced','courier_wallet_withdrawal',$2,$3::jsonb)`,[actorId,withdrawalId,JSON.stringify({from:row.status,to:stage.next,note:note.trim(),providerCalled:false})]);
      return updated;
    });
  },
  async claimProviderCommands({limit=20,staleAfterMinutes=15}={}){
    if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(staleAfterMinutes)||staleAfterMinutes<5||staleAfterMinutes>60)throw fail('invalid_provider_claim',422,'Parâmetros de processamento inválidos.');
    return database.transaction(async client=>(await client.query(`WITH candidates AS (
      SELECT c.id FROM courier_wallet_provider_commands c JOIN courier_wallet_withdrawals w ON w.id=c.withdrawal_id
      WHERE w.status='level5_authorized' AND ((c.status IN ('pending','failed') AND c.available_at<=now()) OR (c.status='processing' AND c.locked_at<now()-($2::int*interval '1 minute')))
      ORDER BY c.available_at,c.id FOR UPDATE OF c SKIP LOCKED LIMIT $1
    ), claimed AS (
      UPDATE courier_wallet_provider_commands c SET status='processing',claim_token=gen_random_uuid(),locked_at=now(),attempts=attempts+1,updated_at=now()
      FROM candidates x WHERE c.id=x.id RETURNING c.*
    ) SELECT claimed.*,w.amount_cents,w.payout_destination_reference
      FROM claimed JOIN courier_wallet_withdrawals w ON w.id=claimed.withdrawal_id`,[limit,staleAfterMinutes])).rows);
  },
  async markProviderPending({commandId,claimToken,providerReferenceHash}){
    if(!/^([0-9a-f]{64})$/.test(providerReferenceHash))throw fail('invalid_provider_evidence',422,'Referência do provedor inválida.');
    return database.transaction(async client=>{
      const command=(await client.query(`UPDATE courier_wallet_provider_commands SET status='delivered',provider_reference_hash=$3,claim_token=NULL,locked_at=NULL,last_error_code=NULL,updated_at=now()
        WHERE id=$1 AND status='processing' AND claim_token=$2 RETURNING *`,[commandId,claimToken,providerReferenceHash])).rows[0];
      if(!command)throw fail('provider_claim_lost',409,'O comando não pertence mais a este processamento.');
      const withdrawal=(await client.query(`UPDATE courier_wallet_withdrawals SET status='provider_pending',provider_reference_hash=$2,updated_at=now()
        WHERE id=$1 AND status='level5_authorized' RETURNING *`,[command.withdrawal_id,providerReferenceHash])).rows[0];
      if(!withdrawal)throw fail('withdrawal_state_conflict',409,'O saque não está mais autorizado para envio.');
      await client.query(`INSERT INTO audit_events(action,entity_type,entity_id,metadata) VALUES('courier.wallet.provider_accepted','courier_wallet_withdrawal',$1,$2::jsonb)`,[withdrawal.id,JSON.stringify({providerReferenceStoredAsHash:true})]);
      return withdrawal;
    });
  },
  async rescheduleProviderCommand({commandId,claimToken,failureCode,retryAfterSeconds=60}){
    if(!/^[a-z0-9_.-]{3,100}$/i.test(failureCode)||!Number.isInteger(retryAfterSeconds)||retryAfterSeconds<30||retryAfterSeconds>3600)throw fail('invalid_provider_failure',422,'Falha temporária inválida.');
    const command=(await database.query(`UPDATE courier_wallet_provider_commands SET status='failed',available_at=now()+($3::int*interval '1 second'),claim_token=NULL,locked_at=NULL,last_error_code=$4,updated_at=now()
      WHERE id=$1 AND status='processing' AND claim_token=$2 AND attempts<8 RETURNING *`,[commandId,claimToken,retryAfterSeconds,failureCode])).rows[0];
    if(!command)throw fail('provider_claim_lost',409,'O comando não pode ser reagendado ou atingiu o limite de tentativas.');
    return command;
  },
  async blockProviderCommand({commandId,claimToken,failureCode}){
    if(!/^[a-z0-9_.-]{3,100}$/i.test(failureCode))throw fail('invalid_provider_failure',422,'Falha terminal inválida.');
    return database.transaction(async client=>{
      const command=(await client.query(`UPDATE courier_wallet_provider_commands SET status='blocked',claim_token=NULL,locked_at=NULL,last_error_code=$3,updated_at=now()
        WHERE id=$1 AND status='processing' AND claim_token=$2 RETURNING *`,[commandId,claimToken,failureCode])).rows[0];
      if(!command)throw fail('provider_claim_lost',409,'O comando não pertence mais a este processamento.');
      await client.query(`INSERT INTO audit_events(action,entity_type,entity_id,metadata) VALUES('courier.wallet.provider_blocked','courier_wallet_withdrawal',$1,$2::jsonb)`,[command.withdrawal_id,JSON.stringify({failureCode,fundsRemainReserved:true,humanReviewRequired:true})]);
      return command;
    });
  },
  async reconcileProviderEvent({providerReferenceHash,status,failureCode=null,evidenceSha256,idempotencyKey}){
    if(!/^([0-9a-f]{64})$/.test(providerReferenceHash)||!['completed','failed'].includes(status))throw fail('invalid_provider_evidence',422,'Evento do provedor inválido.');
    const row=(await database.query('SELECT id FROM courier_wallet_withdrawals WHERE provider_reference_hash=$1',[providerReferenceHash])).rows[0];
    if(!row)throw fail('withdrawal_not_found',404,'Saque não encontrado para a referência informada.');
    if(status==='completed')return this.completeProviderWithdrawal({withdrawalId:row.id,providerReferenceHash,evidenceSha256,idempotencyKey});
    return this.returnProviderWithdrawal({withdrawalId:row.id,failureCode,idempotencyKey});
  },
  async completeProviderWithdrawal({withdrawalId,providerReferenceHash,evidenceSha256,idempotencyKey}){
    if(!/^([0-9a-f]{64})$/.test(providerReferenceHash)||!/^([0-9a-f]{64})$/.test(evidenceSha256)||typeof idempotencyKey!=='string'||idempotencyKey.length<16||idempotencyKey.length>128)throw fail('invalid_provider_evidence',422,'Comprovação do provedor inválida.');
    return database.transaction(async client=>{
      const row=(await client.query('SELECT * FROM courier_wallet_withdrawals WHERE id=$1 FOR UPDATE',[withdrawalId])).rows[0];if(!row)throw fail('withdrawal_not_found',404,'Solicitação não encontrada.');
      const existing=(await client.query('SELECT * FROM courier_wallet_entries WHERE idempotency_key=$1',[idempotencyKey])).rows[0];
      if(existing){if(existing.courier_id!==row.courier_id||existing.source_id!==row.id||existing.kind!=='withdrawal_release')throw fail('wallet_idempotency_conflict',409,'Chave já utilizada em outro lançamento.');return{withdrawal:row,entry:existing,reused:true};}
      if(row.status!=='provider_pending'||row.provider_reference_hash!==providerReferenceHash)throw fail('withdrawal_state_conflict',409,'A confirmação não corresponde ao envio pendente.');
      await account(client,row.courier_id);
      const balanceUpdate=await client.query('UPDATE courier_wallet_accounts SET reserved_cents=reserved_cents-$2,version=version+1,updated_at=now() WHERE courier_id=$1 AND reserved_cents>=$2',[row.courier_id,row.amount_cents]);
      if(balanceUpdate.rowCount!==1)throw fail('wallet_balance_conflict',409,'Saldo reservado inconsistente.');
      const entry=await ledger(client,{courierId:row.courier_id,kind:'withdrawal_release',amountCents:row.amount_cents,sourceType:'pix_withdrawal',sourceId:row.id,providerReferenceHash,evidenceSha256,idempotencyKey});
      const withdrawal=(await client.query("UPDATE courier_wallet_withdrawals SET status='completed',completed_at=now(),updated_at=now() WHERE id=$1 RETURNING *",[row.id])).rows[0];
      await client.query(`INSERT INTO audit_events(action,entity_type,entity_id,metadata) VALUES('courier.wallet.withdrawal_completed','courier_wallet_withdrawal',$1,$2::jsonb)`,[row.id,JSON.stringify({amountCents:row.amount_cents,evidenceStoredAsHash:true})]);
      return{withdrawal,entry,reused:false};
    });
  },
  async returnProviderWithdrawal({withdrawalId,failureCode,idempotencyKey}){
    if(!/^[a-z0-9_.-]{3,100}$/i.test(failureCode)||typeof idempotencyKey!=='string'||idempotencyKey.length<16||idempotencyKey.length>128)throw fail('invalid_provider_failure',422,'Falha terminal inválida.');
    return database.transaction(async client=>{
      const row=(await client.query('SELECT * FROM courier_wallet_withdrawals WHERE id=$1 FOR UPDATE',[withdrawalId])).rows[0];if(!row)throw fail('withdrawal_not_found',404,'Solicitação não encontrada.');
      const existing=(await client.query('SELECT * FROM courier_wallet_entries WHERE idempotency_key=$1',[idempotencyKey])).rows[0];
      if(existing){if(existing.courier_id!==row.courier_id||existing.source_id!==row.id||existing.kind!=='withdrawal_return')throw fail('wallet_idempotency_conflict',409,'Chave já utilizada em outro lançamento.');return{withdrawal:row,entry:existing,reused:true};}
      if(!['level5_authorized','provider_pending'].includes(row.status))throw fail('withdrawal_state_conflict',409,'O saque não pode mais ser devolvido à carteira.');
      await account(client,row.courier_id);
      const balanceUpdate=await client.query('UPDATE courier_wallet_accounts SET available_cents=available_cents+$2,reserved_cents=reserved_cents-$2,version=version+1,updated_at=now() WHERE courier_id=$1 AND reserved_cents>=$2',[row.courier_id,row.amount_cents]);
      if(balanceUpdate.rowCount!==1)throw fail('wallet_balance_conflict',409,'Saldo reservado inconsistente.');
      const entry=await ledger(client,{courierId:row.courier_id,kind:'withdrawal_return',amountCents:row.amount_cents,sourceType:'pix_withdrawal',sourceId:row.id,idempotencyKey});
      const withdrawal=(await client.query("UPDATE courier_wallet_withdrawals SET status='returned',failure_code=$2,updated_at=now() WHERE id=$1 RETURNING *",[row.id,failureCode])).rows[0];
      await client.query("UPDATE courier_wallet_provider_commands SET status='cancelled',claim_token=NULL,locked_at=NULL,last_error_code=$2,updated_at=now() WHERE withdrawal_id=$1",[row.id,failureCode]);
      await client.query(`INSERT INTO audit_events(action,entity_type,entity_id,metadata) VALUES('courier.wallet.withdrawal_returned','courier_wallet_withdrawal',$1,$2::jsonb)`,[row.id,JSON.stringify({amountCents:row.amount_cents,failureCode})]);
      return{withdrawal,entry,reused:false};
    });
  },
  async summary(courierId){const a=(await database.query('SELECT available_cents,reserved_cents,version,updated_at FROM courier_wallet_accounts WHERE courier_id=$1',[courierId])).rows[0];return a??{available_cents:0,reserved_cents:0,version:0,updated_at:null};},
  async activity(courierId,{limit=50}={}){
    const [entries,withdrawals]=await Promise.all([
      database.query(`SELECT id,kind,amount_cents,available_after_cents,reserved_after_cents,source_type,created_at
        FROM courier_wallet_entries WHERE courier_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2`,[courierId,limit]),
      database.query(`SELECT id,amount_cents,status,requested_at,completed_at,updated_at
        FROM courier_wallet_withdrawals WHERE courier_id=$1 ORDER BY requested_at DESC,id DESC LIMIT $2`,[courierId,limit]),
    ]);
    return{entries:entries.rows,withdrawals:withdrawals.rows};
  },
  async blockedProviderCommands({limit=50}={}){
    if(!Number.isInteger(limit)||limit<1||limit>100)throw fail('invalid_provider_query',422,'Consulta de saques inválida.');
    return (await database.query(`SELECT c.id AS command_id,c.withdrawal_id,c.attempts,c.last_error_code,c.updated_at,w.amount_cents,w.status AS withdrawal_status,w.requested_at
      FROM courier_wallet_provider_commands c JOIN courier_wallet_withdrawals w ON w.id=c.withdrawal_id
      WHERE c.status='blocked' ORDER BY c.updated_at,c.id LIMIT $1`,[limit])).rows;
  },
});}
