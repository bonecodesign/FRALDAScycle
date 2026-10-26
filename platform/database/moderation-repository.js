import { createHash } from 'node:crypto';
const fail = (code,status,message) => Object.assign(new Error(message), {code,status});
export async function newOperationsAllowed(client,userId) {
  const result=await client.query(`SELECT
    EXISTS(SELECT 1 FROM moderation_decisions WHERE owner_id=$1 AND surface='account' AND status<>'overturned' AND suspended_until>clock_timestamp()) AS suspended,
    EXISTS(SELECT 1 FROM account_operation_restrictions WHERE user_id=$1 AND reason='closure_pending') AS closure_pending`,[userId]);
  return result.rows[0]?.suspended===false&&result.rows[0]?.closure_pending!==true;
}
export async function requireNewOperations(client,userId) {
  if(!await newOperationsAllowed(client,userId)) throw fail('new_operations_suspended',403,'Novas operações estão suspensas. Acompanhamento das operações existentes e suporte continuam disponíveis.');
}
export function createModerationRepository(database) {
  return Object.freeze({
    async exception(input) {
      return (await database.query(`SELECT id FROM moderation_decisions WHERE owner_id=$1 AND surface=$2 AND content_hash=$3 AND rule_version=$4 AND transaction_id IS NOT DISTINCT FROM $5::uuid AND status='overturned'`,[input.userId,input.surface,input.hash,input.ruleVersion,input.transactionId])).rows.length>0;
    },
    async recordBlocked(input) {
      return database.transaction(async client=>{
        const row=(await client.query(`INSERT INTO moderation_decisions(owner_id,surface,transaction_id,rule_version,content_hash,reasons,reason)
          VALUES($1,$2,$3,$4,$5,$6::jsonb,$7) ON CONFLICT DO NOTHING RETURNING id`,[input.userId,input.surface,input.transactionId,input.ruleVersion,input.hash,JSON.stringify(input.reasons),'Conteúdo identificado pela regra de contatos; bloqueado para revisão.'])).rows[0];
        if(row) await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'moderation.content.blocked','moderation_decision',$2,$3::jsonb)`,[input.userId,row.id,JSON.stringify({surface:input.surface,reasons:input.reasons,ruleVersion:input.ruleVersion})]);
        return row || (await client.query(`SELECT id FROM moderation_decisions WHERE owner_id=$1 AND surface=$2 AND content_hash=$3 AND rule_version=$4 AND transaction_id IS NOT DISTINCT FROM $5::uuid`,[input.userId,input.surface,input.hash,input.ruleVersion,input.transactionId])).rows[0];
      });
    },
    async list({userId,reviewer=false}) {
      return database.transaction(async client=>{
        const result=await client.query(`SELECT d.id,d.surface,d.reasons,d.reason,d.status,d.suspended_until,d.created_at,a.id AS appeal_id,a.ticket_id,a.outcome
          FROM moderation_decisions d LEFT JOIN moderation_appeals a ON a.decision_id=d.id WHERE d.owner_id=$1 OR $2::boolean ORDER BY d.created_at DESC LIMIT 100`,[userId,reviewer]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'moderation.decisions.read','moderation_decision','list',$2::jsonb)`,[userId,JSON.stringify({reviewer,count:result.rows.length})]);
        return result.rows;
      });
    },
    appeal({userId,decisionId,body}) {
      return database.transaction(async client=>{
        const d=(await client.query('SELECT * FROM moderation_decisions WHERE id=$1 AND owner_id=$2 FOR UPDATE',[decisionId,userId])).rows[0];
        if(!d) throw fail('moderation_decision_not_found',404,'Decisão não encontrada.');
        const existing=(await client.query('SELECT id,ticket_id FROM moderation_appeals WHERE decision_id=$1',[decisionId])).rows[0];
        if(existing) return {appeal:existing,reused:true};
        if(d.status!=='blocked') throw fail('moderation_appeal_closed',409,'Esta decisão já foi revisada. Solicite acompanhamento pelo suporte.');
        const ticket=(await client.query(`INSERT INTO support_tickets(requester_id,transaction_id,category,subject,details,idempotency_key)
          VALUES($1,$2,'account','Contestação de moderação',$3,$4) RETURNING id,protocol`,[userId,d.transaction_id,body,'moderation-appeal:'+decisionId])).rows[0];
        const appeal=(await client.query('INSERT INTO moderation_appeals(decision_id,ticket_id,requester_id) VALUES($1,$2,$3) RETURNING id,ticket_id',[decisionId,ticket.id,userId])).rows[0];
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'moderation.appeal.created','moderation_decision',$2,'{}'::jsonb)`,[userId,decisionId]);
        return {appeal,protocol:ticket.protocol,reused:false};
      });
    },
    async detail({userId,decisionId,reviewer=false}) {
      return database.transaction(async client=>{
        const row=(await client.query(`SELECT d.id,d.surface,d.reason,d.reasons,d.status,d.decided_by,d.suspended_until,a.id AS appeal_id,a.ticket_id,a.outcome,a.review_reason,t.details AS appeal_body
          FROM moderation_decisions d LEFT JOIN moderation_appeals a ON a.decision_id=d.id LEFT JOIN support_tickets t ON t.id=a.ticket_id
          WHERE d.id=$1 AND (d.owner_id=$2 OR $3::boolean)`,[decisionId,userId,reviewer])).rows[0];
        if(!row) throw fail('moderation_decision_not_found',404,'Decisão não encontrada.');
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'moderation.decision.read','moderation_decision',$2,'{}'::jsonb)`,[userId,decisionId]);
        return row;
      });
    },
    reviewAppeal({actorId,decisionId,outcome,reason,reviewedText}) {
      return database.transaction(async client=>{
        const d=(await client.query('SELECT * FROM moderation_decisions WHERE id=$1 FOR UPDATE',[decisionId])).rows[0];
        if(!d) throw fail('moderation_decision_not_found',404,'Decisão não encontrada.');
        if([d.owner_id,d.decided_by].includes(actorId)) throw fail('moderation_independent_reviewer_required',403,'A revisão precisa de pessoa diferente do titular e da decisão inicial.');
        const a=(await client.query('SELECT * FROM moderation_appeals WHERE decision_id=$1',[decisionId])).rows[0];
        if(!a) throw fail('moderation_appeal_not_found',404,'Contestação não encontrada.');
        if(a.reviewed_at) {
          if(a.outcome!==outcome || a.review_reason!==reason) throw fail('moderation_review_conflict',409,'A revisão já foi registrada.');
          return {reused:true,status:a.outcome};
        }
        if(outcome==='overturned'&&d.surface!=='account') {
          if(d.reasons.includes('private_review_content')) throw fail('privacy_exception_unavailable',409,'Conteúdo privado precisa ser corrigido; esta revisão não autoriza exposição de dados.');
          if(typeof reviewedText!=='string'||createHash('sha256').update(reviewedText).digest('hex')!==d.content_hash) throw fail('moderation_review_content_mismatch',422,'Confira o conteúdo original integral antes de registrar um falso positivo.');
        }
        await client.query('UPDATE moderation_appeals SET outcome=$2,review_reason=$3,reviewed_by=$4,reviewed_at=now() WHERE id=$1',[a.id,outcome,reason,actorId]);
        await client.query('UPDATE moderation_decisions SET status=$2 WHERE id=$1',[decisionId,outcome]);
        await client.query('INSERT INTO support_ticket_messages(ticket_id,author_id,body) VALUES($1,$2,$3)',[a.ticket_id,actorId,reason]);
        await client.query("UPDATE support_tickets SET status='resolved',updated_at=now() WHERE id=$1",[a.ticket_id]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'moderation.appeal.reviewed','moderation_decision',$2,$3::jsonb)`,[actorId,decisionId,JSON.stringify({outcome})]);
        return {reused:false,status:outcome};
      });
    },
    suspend({actorId,userId,reason,until,idempotencyKey}) {
      return database.transaction(async client=>{
        if(actorId===userId) throw fail('moderation_independent_actor_required',403,'Não é permitido moderar a própria conta.');
        const user=(await client.query('SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE',[userId])).rows[0];
        if(!user) throw fail('account_not_found',404,'Conta não encontrada.');
        const existing=(await client.query('SELECT * FROM moderation_decisions WHERE idempotency_key=$1',[idempotencyKey])).rows[0];
        if(existing) {
          if(existing.owner_id!==userId || existing.decided_by!==actorId || existing.reason!==reason || new Date(existing.suspended_until).toISOString()!==until) throw fail('moderation_key_conflict',409,'Use uma nova chave para esta decisão.');
          return {decision:{id:existing.id},reused:true};
        }
        const decision=(await client.query(`INSERT INTO moderation_decisions(owner_id,surface,rule_version,reason,decided_by,suspended_until,idempotency_key)
          SELECT $1,'account','FC-MODERATION-1',$2,$3,$4::timestamptz,$5 WHERE $4::timestamptz>clock_timestamp() ON CONFLICT(idempotency_key) DO NOTHING RETURNING id`,[userId,reason,actorId,until,idempotencyKey])).rows[0];
        if(!decision) throw fail('invalid_suspension_period',422,'Informe término futuro da suspensão temporária.');
        await client.query("UPDATE listings SET status='paused',updated_at=now() WHERE seller_id=$1 AND status='published' AND NOT EXISTS(SELECT 1 FROM transactions t WHERE t.listing_id=listings.id AND t.status NOT IN ('cancelled','refunded','completed'))",[userId]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'moderation.account.suspended','moderation_decision',$2,$3::jsonb)`,[actorId,decision.id,JSON.stringify({until})]);
        return {decision,reused:false};
      });
    },
  });
}
