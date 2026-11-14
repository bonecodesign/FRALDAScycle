import { createHash } from 'node:crypto';
const fail = (code,status,message) => Object.assign(new Error(message), {code,status});
async function releaseSuspension(client,decision,reason) {
  const existing=(await client.query('SELECT * FROM moderation_suspension_releases WHERE decision_id=$1',[decision.id])).rows[0];
  if(existing)return {reused:true,restoredListings:existing.restored_listings};
  const restored=(await client.query(`UPDATE listings l SET status='published',updated_at=now() FROM moderation_listing_pauses p
    WHERE p.decision_id=$1 AND p.listing_id=l.id AND p.restored_at IS NULL AND l.status='paused'
      AND NOT EXISTS(SELECT 1 FROM moderation_decisions d WHERE d.owner_id=l.seller_id AND d.surface='account' AND d.id<>$1 AND d.status<>'overturned' AND d.suspended_until>clock_timestamp())
      AND NOT EXISTS(SELECT 1 FROM transactions t WHERE t.listing_id=l.id AND t.status NOT IN('cancelled','refunded','completed'))
    RETURNING l.id`,[decision.id])).rows;
  await client.query('UPDATE moderation_listing_pauses SET restored_at=now() WHERE restored_at IS NULL AND listing_id=ANY($1::uuid[])',[restored.map(row=>row.id)]);
  await client.query('INSERT INTO moderation_suspension_releases(decision_id,reason,restored_listings) VALUES($1,$2,$3)',[decision.id,reason,restored.length]);
  await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES(NULL,'moderation.account.released','moderation_decision',$1,$2::jsonb)`,[decision.id,JSON.stringify({reason,restoredListings:restored.length})]);
  return {reused:false,restoredListings:restored.length};
}
export async function newOperationsAllowed(client,userId) {
  const result=await client.query(`SELECT
    EXISTS(SELECT 1 FROM moderation_decisions WHERE owner_id=$1 AND surface='account' AND status<>'overturned' AND suspended_until>clock_timestamp()) AS suspended,
    EXISTS(SELECT 1 FROM account_operation_restrictions WHERE user_id=$1 AND reason='closure_pending') AS closure_pending,
    EXISTS(SELECT 1 FROM moderation_sanction_effects WHERE user_id=$1 AND active AND action<>'warning' AND (ends_at IS NULL OR ends_at>clock_timestamp())) AS sanction_restricted`,[userId]);
  return result.rows[0]?.suspended===false&&result.rows[0]?.closure_pending!==true&&result.rows[0]?.sanction_restricted!==true;
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
        if(outcome==='overturned'&&d.surface==='account')await releaseSuspension(client,d,'overturned');
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
        await client.query(`INSERT INTO moderation_listing_pauses(decision_id,listing_id)
          SELECT $1,l.id FROM listings l WHERE l.seller_id=$2 AND (l.status='published' OR (l.status='paused' AND EXISTS(
            SELECT 1 FROM moderation_listing_pauses prior WHERE prior.listing_id=l.id AND prior.restored_at IS NULL)))
            AND NOT EXISTS(SELECT 1 FROM transactions t WHERE t.listing_id=l.id AND t.status NOT IN('cancelled','refunded','completed'))
          ON CONFLICT DO NOTHING`,[decision.id,userId]);
        await client.query("UPDATE listings SET status='paused',updated_at=now() WHERE id IN(SELECT listing_id FROM moderation_listing_pauses WHERE decision_id=$1)",[decision.id]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'moderation.account.suspended','moderation_decision',$2,$3::jsonb)`,[actorId,decision.id,JSON.stringify({until})]);
        return {decision,reused:false};
      });
    },
    releaseExpired(limit=50) {
      return database.transaction(async client=>{
        const due=(await client.query(`SELECT d.* FROM moderation_decisions d WHERE d.surface='account' AND d.status<>'overturned' AND d.suspended_until<=clock_timestamp()
          AND NOT EXISTS(SELECT 1 FROM moderation_suspension_releases r WHERE r.decision_id=d.id) ORDER BY d.suspended_until,d.id FOR UPDATE SKIP LOCKED LIMIT $1`,[limit])).rows;
        let restoredListings=0;for(const decision of due)restoredListings+=(await releaseSuspension(client,decision,'expired')).restoredListings;
        return {released:due.length,restoredListings,permanentBansApplied:0};
      });
    },
    proposeSanction({actorId,userId,action,until,reason}) {
      return database.transaction(async client=>{
        if(actorId===userId)throw fail('moderation_independent_actor_required',403,'Não é permitido propor sanção para a própria conta.');
        const actor=(await client.query("SELECT staff_access_level,staff_sector FROM users WHERE id=$1 AND role='admin' AND disabled_at IS NULL FOR SHARE",[actorId])).rows[0];
        if(Number(actor?.staff_access_level)!==3||actor.staff_sector!=='moderation')throw fail('forbidden',403,'Somente moderação nível 3 pode propor sanção.');
        const target=(await client.query('SELECT id FROM users WHERE id=$1 AND disabled_at IS NULL FOR SHARE',[userId])).rows[0];
        if(!target)throw fail('account_not_found',404,'Conta não encontrada.');
        const row=(await client.query(`INSERT INTO moderation_sanction_cases(user_id,proposed_action,proposed_until,proposal_reason,proposed_by)
          VALUES($1,$2,$3,$4,$5) RETURNING *`,[userId,action,until,reason,actorId])).rows[0];
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'moderation.sanction.proposed','moderation_sanction_case',$2,$3::jsonb)`,[actorId,row.id,JSON.stringify({proposedAction:action,accountRestricted:false,irreversibleActionApplied:false})]);
        return row;
      });
    },
    reviewSanction({actorId,caseId,action,until,reason}) {
      return database.transaction(async client=>{
        const actor=(await client.query("SELECT staff_access_level,staff_sector FROM users WHERE id=$1 AND role='admin' AND disabled_at IS NULL FOR SHARE",[actorId])).rows[0];
        if(Number(actor?.staff_access_level)!==4||actor.staff_sector!=='moderation')throw fail('forbidden',403,'Somente moderação nível 4 pode revisar a proposta.');
        const current=(await client.query("SELECT * FROM moderation_sanction_cases WHERE id=$1 AND status='proposed' FOR UPDATE",[caseId])).rows[0];
        if(!current)throw fail('moderation_sanction_not_reviewable',409,'A proposta não está disponível para revisão.');
        if(current.proposed_by===actorId)throw fail('moderation_independent_reviewer_required',403,'Proponente e revisor devem ser pessoas diferentes.');
        const row=(await client.query(`UPDATE moderation_sanction_cases SET status='level4_approved',level4_action=$2,level4_until=$3,level4_reason=$4,level4_by=$5,level4_at=now(),updated_at=now() WHERE id=$1 RETURNING *`,[caseId,action,until,reason,actorId])).rows[0];
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'moderation.sanction.level4_reviewed','moderation_sanction_case',$2,$3::jsonb)`,[actorId,caseId,JSON.stringify({approvedAction:action,modified:action!==current.proposed_action||String(until??'')!==String(current.proposed_until??''),accountRestricted:false,irreversibleActionApplied:false})]);
        return row;
      });
    },
    authorizeSanction({actorId,caseId,note}) {
      return database.transaction(async client=>{
        const actor=(await client.query("SELECT staff_access_level,staff_sector FROM users WHERE id=$1 AND role='admin' AND disabled_at IS NULL FOR SHARE",[actorId])).rows[0];
        if(Number(actor?.staff_access_level)!==5||actor.staff_sector!=='founder')throw fail('forbidden',403,'Somente o fundador nível 5 pode autorizar a sanção.');
        const current=(await client.query("SELECT * FROM moderation_sanction_cases WHERE id=$1 AND status='level4_approved' FOR UPDATE",[caseId])).rows[0];
        if(!current)throw fail('moderation_sanction_not_authorizable',409,'A sanção não está disponível para autorização final.');
        if([current.proposed_by,current.level4_by].includes(actorId))throw fail('moderation_independent_authorizer_required',403,'O autorizador final deve ser uma terceira pessoa.');
        const row=(await client.query("UPDATE moderation_sanction_cases SET status='level5_authorized',level5_note=$2,level5_by=$3,level5_at=now(),updated_at=now() WHERE id=$1 RETURNING *",[caseId,note,actorId])).rows[0];
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'moderation.sanction.level5_authorized','moderation_sanction_case',$2,$3::jsonb)`,[actorId,caseId,JSON.stringify({authorizedAction:row.level4_action,accountRestricted:false,executionPending:true})]);
        return row;
      });
    },
    executeSanction({actorId,caseId}) {
      return database.transaction(async client=>{
        const actor=(await client.query("SELECT staff_access_level,staff_sector FROM users WHERE id=$1 AND role='admin' AND disabled_at IS NULL FOR SHARE",[actorId])).rows[0];
        if(Number(actor?.staff_access_level)!==5||actor.staff_sector!=='founder')throw fail('forbidden',403,'Somente o fundador nível 5 pode confirmar a execução.');
        const current=(await client.query("SELECT * FROM moderation_sanction_cases WHERE id=$1 FOR UPDATE",[caseId])).rows[0];
        if(!current)throw fail('moderation_sanction_not_executable',409,'A sanção não está disponível para execução.');
        const existing=(await client.query('SELECT * FROM moderation_sanction_effects WHERE case_id=$1',[caseId])).rows[0];
        if(existing&&current.status==='executed')return{case:current,effect:existing,reused:true};
        if(current.status!=='level5_authorized'||current.level5_by!==actorId)throw fail('moderation_sanction_not_executable',409,'A execução exige autorização final válida do próprio fundador.');
        const effect=(await client.query(`INSERT INTO moderation_sanction_effects(case_id,user_id,action,ends_at) VALUES($1,$2,$3,$4) RETURNING *`,[caseId,current.user_id,current.level4_action,current.level4_until])).rows[0];
        const row=(await client.query("UPDATE moderation_sanction_cases SET status='executed',executed_at=now(),updated_at=now() WHERE id=$1 RETURNING *",[caseId])).rows[0];
        const message=current.level4_action==='warning'?'Você recebeu uma advertência de moderação. Consulte o motivo e o canal de contestação no painel.':current.level4_action==='temporary_suspension'?'Novas operações estão suspensas temporariamente. Consulte o prazo, o motivo e o canal de contestação no painel.':'Novas operações foram restringidas por decisão de moderação. Sua conta, histórico, suporte e contestação continuam acessíveis.';
        await client.query(`INSERT INTO account_notices(user_id,kind,message,dedupe_key) VALUES($1,'moderation_sanction',$2,$3) ON CONFLICT(dedupe_key) DO NOTHING`,[current.user_id,message,`moderation-sanction:${caseId}:executed`]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'moderation.sanction.executed','moderation_sanction_case',$2,$3::jsonb)`,[actorId,caseId,JSON.stringify({action:current.level4_action,newOperationsRestricted:current.level4_action!=='warning',loginDisabled:false,supportPreserved:true,existingObligationsPreserved:true})]);
        return{case:row,effect,reused:false};
      });
    },
    appealSanction({userId,caseId,body}) {
      return database.transaction(async client=>{
        const current=(await client.query("SELECT c.*,e.active FROM moderation_sanction_cases c JOIN moderation_sanction_effects e ON e.case_id=c.id WHERE c.id=$1 AND c.user_id=$2 AND c.status='executed' FOR UPDATE OF c,e",[caseId,userId])).rows[0];
        if(!current)throw fail('moderation_sanction_not_appealable',404,'Sanção disponível para contestação não encontrada.');
        const existing=(await client.query('SELECT * FROM moderation_sanction_appeals WHERE case_id=$1',[caseId])).rows[0];
        if(existing)return{appeal:existing,reused:true};
        const ticket=(await client.query(`INSERT INTO support_tickets(requester_id,category,subject,details,idempotency_key) VALUES($1,'account','Contestação de sanção graduada',$2,$3) RETURNING id,protocol`,[userId,body,`moderation-sanction-appeal:${caseId}`])).rows[0];
        const appeal=(await client.query('INSERT INTO moderation_sanction_appeals(case_id,ticket_id,requester_id) VALUES($1,$2,$3) RETURNING *',[caseId,ticket.id,userId])).rows[0];
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'moderation.sanction.appeal_created','moderation_sanction_case',$2,$3::jsonb)`,[userId,caseId,JSON.stringify({appealId:appeal.id,effectChanged:false})]);
        return{appeal,protocol:ticket.protocol,reused:false};
      });
    },
    analyzeSanctionAppeal({actorId,appealId,outcome,note}) {
      return database.transaction(async client=>{
        const actor=(await client.query("SELECT staff_access_level,staff_sector FROM users WHERE id=$1 AND role='admin' AND disabled_at IS NULL FOR SHARE",[actorId])).rows[0];if(Number(actor?.staff_access_level)!==3||actor.staff_sector!=='moderation')throw fail('forbidden',403,'Somente moderação nível 3 pode analisar o recurso.');
        const row=(await client.query(`SELECT a.*,c.user_id,c.proposed_by,c.level4_by,c.level5_by FROM moderation_sanction_appeals a JOIN moderation_sanction_cases c ON c.id=a.case_id WHERE a.id=$1 AND a.status='pending_level3' FOR UPDATE OF a`,[appealId])).rows[0];if(!row)throw fail('moderation_sanction_appeal_not_analyzable',409,'Recurso indisponível para análise.');if([row.user_id,row.proposed_by,row.level4_by,row.level5_by].includes(actorId))throw fail('moderation_independent_reviewer_required',403,'A análise do recurso exige pessoa independente.');
        const updated=(await client.query("UPDATE moderation_sanction_appeals SET status='pending_level4',level3_outcome=$2,level3_note=$3,level3_by=$4,level3_at=now(),updated_at=now() WHERE id=$1 RETURNING *",[appealId,outcome,note,actorId])).rows[0];await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'moderation.sanction.appeal_level3','moderation_sanction_appeal',$2,$3::jsonb)`,[actorId,appealId,JSON.stringify({outcome,effectChanged:false})]);return updated;
      });
    },
    reviewSanctionAppeal({actorId,appealId,outcome,note}) {
      return database.transaction(async client=>{
        const actor=(await client.query("SELECT staff_access_level,staff_sector FROM users WHERE id=$1 AND role='admin' AND disabled_at IS NULL FOR SHARE",[actorId])).rows[0];if(Number(actor?.staff_access_level)!==4||actor.staff_sector!=='moderation')throw fail('forbidden',403,'Somente moderação nível 4 pode revisar o recurso.');
        const row=(await client.query(`SELECT a.*,c.user_id,c.proposed_by,c.level4_by,c.level5_by FROM moderation_sanction_appeals a JOIN moderation_sanction_cases c ON c.id=a.case_id WHERE a.id=$1 AND a.status='pending_level4' FOR UPDATE OF a`,[appealId])).rows[0];if(!row)throw fail('moderation_sanction_appeal_not_reviewable',409,'Recurso indisponível para revisão.');if([row.user_id,row.proposed_by,row.level4_by,row.level5_by,row.level3_by].includes(actorId))throw fail('moderation_independent_reviewer_required',403,'A revisão do recurso exige pessoa independente.');
        const updated=(await client.query("UPDATE moderation_sanction_appeals SET status='pending_level5',level4_outcome=$2,level4_note=$3,level4_by=$4,level4_at=now(),updated_at=now() WHERE id=$1 RETURNING *",[appealId,outcome,note,actorId])).rows[0];await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'moderation.sanction.appeal_level4','moderation_sanction_appeal',$2,$3::jsonb)`,[actorId,appealId,JSON.stringify({outcome,modified:outcome!==row.level3_outcome,effectChanged:false})]);return updated;
      });
    },
    decideSanctionAppeal({actorId,appealId,note}) {
      return database.transaction(async client=>{
        const actor=(await client.query("SELECT staff_access_level,staff_sector FROM users WHERE id=$1 AND role='admin' AND disabled_at IS NULL FOR SHARE",[actorId])).rows[0];if(Number(actor?.staff_access_level)!==5||actor.staff_sector!=='founder')throw fail('forbidden',403,'Somente o fundador nível 5 pode decidir o recurso.');
        const row=(await client.query(`SELECT a.*,c.user_id,c.proposed_by,c.level4_by AS sanction_level4_by,c.level5_by AS sanction_level5_by FROM moderation_sanction_appeals a JOIN moderation_sanction_cases c ON c.id=a.case_id WHERE a.id=$1 AND a.status='pending_level5' FOR UPDATE OF a,c`,[appealId])).rows[0];if(!row)throw fail('moderation_sanction_appeal_not_decidable',409,'Recurso indisponível para decisão final.');if([row.user_id,row.proposed_by,row.sanction_level4_by,row.level3_by,row.level4_by].includes(actorId))throw fail('moderation_independent_authorizer_required',403,'A decisão final exige separação dos analistas níveis 3 e 4. O fundador único pode decidir o recurso.');
        const reversed=row.level4_outcome==='reverse',status=reversed?'reversed':'upheld';
        if(reversed){await client.query("UPDATE moderation_sanction_effects SET active=false,reversed_at=now(),reversed_by=$2,reversal_reason=$3 WHERE case_id=$1 AND active",[row.case_id,actorId,note]);await client.query("UPDATE moderation_sanction_cases SET status='reversed',updated_at=now() WHERE id=$1",[row.case_id]);}
        const updated=(await client.query("UPDATE moderation_sanction_appeals SET status=$2,level5_note=$3,level5_by=$4,level5_at=now(),updated_at=now() WHERE id=$1 RETURNING *",[appealId,status,note,actorId])).rows[0];await client.query("UPDATE support_tickets SET status='resolved',updated_at=now() WHERE id=$1",[row.ticket_id]);await client.query('INSERT INTO support_ticket_messages(ticket_id,author_id,body) VALUES($1,$2,$3)',[row.ticket_id,actorId,note]);
        const message=reversed?'Sua contestação foi aceita e a sanção foi revertida.':'Sua contestação foi analisada e a sanção foi mantida.';await client.query(`INSERT INTO account_notices(user_id,kind,message,dedupe_key) VALUES($1,'moderation_sanction',$2,$3) ON CONFLICT(dedupe_key) DO NOTHING`,[row.user_id,message,`moderation-sanction:${row.case_id}:appeal-final`]);await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'moderation.sanction.appeal_decided','moderation_sanction_appeal',$2,$3::jsonb)`,[actorId,appealId,JSON.stringify({outcome:row.level4_outcome,effectReversed:reversed,historyPreserved:true})]);return updated;
      });
    },
  });
}
