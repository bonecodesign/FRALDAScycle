const fail=(code,status,message)=>Object.assign(new Error(message),{code,status});
const roleError=()=>fail('support_duty_roster_conflict',409,'Já existe indicação ou responsável vigente para esta função ou pessoa.');
const permittedTarget=row=>row&&row.disabled_at==null&&row.email_verified_at!=null&&
  ['admin','moderator'].includes(row.role)&&row.staff_sector==='support'&&Number(row.staff_access_level)>=1&&Number(row.staff_access_level)<=4;
export function createSupportDutyRepository(database,{stepUpRepository}){
 const consume=async(client,actorId,grantId)=>{
  const verified=await stepUpRepository.consume(client,{grantId,userId:actorId,purpose:'support_duty_assignment'});
  if(!verified)throw fail('support_duty_step_up_required',409,'A confirmação individual é inválida, expirada ou já foi utilizada.');
 };
 const actor=async(client,id)=>{
  const result=await client.query('SELECT id,staff_access_level,staff_sector,role,disabled_at FROM users WHERE id=$1 FOR UPDATE',[id]);
  return result.rows[0];
 };
 const valid=(row,level,sector)=>{
  if(!row||row.disabled_at||row.role!=='admin'||Number(row.staff_access_level)!==level||
    row.staff_sector!==sector)throw fail('support_duty_role_changed',403,'A função interna foi alterada. Refaça a autorização.');
 };
 const appendAudit=(client,actorId,action,id,metadata={})=>client.query(
  'INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,\'support_duty\',$3,$4::jsonb)',
  [actorId,action,id,JSON.stringify(metadata)]);
 const lockRole=(client,roleKind)=>client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))',[ 'support-duty:'+roleKind ]);
 const assertSlot=async(client,roleKind,targetUserId)=>{
  const a=await client.query(`SELECT id FROM support_duty_proposals WHERE status IN ('pending_review','pending_founder')
    AND (role_kind=$1 OR target_user_id=$2) LIMIT 1`,[roleKind,targetUserId]);
  const b=await client.query(`SELECT id FROM support_duty_assignments WHERE status IN ('pending','accepted')
    AND (role_kind=$1 OR target_user_id=$2) LIMIT 1`,[roleKind,targetUserId]);
  if(a.rows.length||b.rows.length)throw roleError();
 };
 return Object.freeze({
  async list({actorId,leadership}){
   const scope=leadership?'':'AND (p.proposed_by=$1 OR p.target_user_id=$1)';
   const [proposals,assignments]=await Promise.all([
    database.query(`SELECT p.id,p.role_kind,p.target_user_id,p.proposed_by,p.status,p.proposal_reason,
      p.review_reason,p.decision_reason,p.created_at,p.reviewed_at,p.decided_at,
      target.display_name AS target_name FROM support_duty_proposals p
      JOIN users target ON target.id=p.target_user_id
      WHERE true ${scope} ORDER BY p.created_at DESC LIMIT 100`,leadership?[]:[actorId]),
    database.query(`SELECT a.id,a.role_kind,a.target_user_id,a.status,a.created_at,a.accepted_at,
      a.revoked_at,a.revoke_reason,target.display_name AS target_name FROM support_duty_assignments a
      JOIN users target ON target.id=a.target_user_id
      WHERE true ${leadership?'':'AND a.target_user_id=$1'} ORDER BY a.created_at DESC LIMIT 100`,leadership?[]:[actorId]),
   ]);
   return {proposals:proposals.rows,assignments:assignments.rows};
  },
  propose({actorId,targetUserId,roleKind,reason,grantId}){
   return database.transaction(async client=>{
    await lockRole(client,roleKind);
    const self=await actor(client,actorId);
    valid(self,3,'support');
    const target=(await client.query('SELECT id,role,staff_access_level,staff_sector,email_verified_at,disabled_at FROM users WHERE id=$1 FOR UPDATE',[targetUserId])).rows[0];
    if(!permittedTarget(target)||actorId===targetUserId)throw fail('support_duty_target_ineligible',409,'Indicação exige outra pessoa ativa com conta individual e setor de suporte.');
    await assertSlot(client,roleKind,targetUserId);
    await consume(client,actorId,grantId);
    const row=(await client.query(`INSERT INTO support_duty_proposals
      (role_kind,target_user_id,proposed_by,proposal_step_up_id,proposal_reason)
      VALUES($1,$2,$3,$4,$5) RETURNING id,role_kind,target_user_id,status`,
      [roleKind,targetUserId,actorId,grantId,reason])).rows[0];
    await appendAudit(client,actorId,'support.duty.proposed',row.id,{roleKind});
    return row;
   });
  },
  review({actorId,proposalId,approved,reason,grantId}){
   return database.transaction(async client=>{
    const proposal=(await client.query('SELECT * FROM support_duty_proposals WHERE id=$1 FOR UPDATE',[proposalId])).rows[0];
    if(!proposal||proposal.status!=='pending_review')throw fail('support_duty_proposal_not_pending',409,'Indicação não está aguardando revisão.');
    const self=await actor(client,actorId);
    valid(self,4,'operations');
    if([proposal.target_user_id,proposal.proposed_by].includes(actorId))throw fail('support_duty_independence_required',403,'A revisão precisa ser realizada por pessoa independente.');
    await consume(client,actorId,grantId);
    const status=approved?'pending_founder':'rejected';
    const row=(await client.query(`UPDATE support_duty_proposals SET status=$2,
      reviewed_by=$3,review_step_up_id=$4,review_reason=$5,review_approved=$6,reviewed_at=now()
      WHERE id=$1 RETURNING id,role_kind,status`,
      [proposalId,status,actorId,grantId,reason,approved])).rows[0];
    await appendAudit(client,actorId,approved?'support.duty.review_approved':'support.duty.review_rejected',proposalId,{roleKind:proposal.role_kind});
    return row;
   });
  },
  decide({actorId,proposalId,approved,reason,grantId}){
   return database.transaction(async client=>{
    const proposal=(await client.query('SELECT * FROM support_duty_proposals WHERE id=$1 FOR UPDATE',[proposalId])).rows[0];
    if(!proposal||proposal.status!=='pending_founder'||proposal.review_approved!==true)throw fail('support_duty_founder_gate_required',409,'É necessária a revisão independente anterior.');
    await lockRole(client,proposal.role_kind);
    const self=await actor(client,actorId);valid(self,5,'founder');
    if([proposal.target_user_id,proposal.proposed_by,proposal.reviewed_by].includes(actorId))
      throw fail('support_duty_independence_required',403,'O fundador não pode acumular funções incompatíveis.');
    if(approved){
     const target=(await client.query('SELECT id,role,staff_access_level,staff_sector,email_verified_at,disabled_at FROM users WHERE id=$1 FOR UPDATE',[proposal.target_user_id])).rows[0];
     if(!permittedTarget(target))throw fail('support_duty_target_ineligible',409,'Conta do indicado perdeu a elegibilidade.');
     const current=(await client.query(`SELECT id FROM support_duty_assignments WHERE status IN ('pending','accepted')
       AND (role_kind=$1 OR target_user_id=$2) LIMIT 1`,[proposal.role_kind,proposal.target_user_id])).rows;
     if(current.length)throw roleError();
    }
    await consume(client,actorId,grantId);
    const status=approved?'approved':'rejected';
    const row=(await client.query(`UPDATE support_duty_proposals SET status=$2,decided_by=$3,
      decision_step_up_id=$4,decision_reason=$5,decided_at=now() WHERE id=$1
      RETURNING id,role_kind,target_user_id,status`,
      [proposalId,status,actorId,grantId,reason])).rows[0];
    let assignment=null;
    if(approved){
     assignment=(await client.query(`INSERT INTO support_duty_assignments
       (role_kind,target_user_id,appointed_by,appointment_step_up_id,reason,proposal_id)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id,role_kind,target_user_id,status`,
       [proposal.role_kind,proposal.target_user_id,actorId,grantId,proposal.proposal_reason,proposalId])).rows[0];
    }
    await appendAudit(client,actorId,approved?'support.duty.founder_approved':'support.duty.founder_rejected',proposalId,{roleKind:proposal.role_kind,assignmentCreated:Boolean(assignment)});
    return {proposal:row,assignment};
   });
  },
  respond({actorId,assignmentId,accepted,grantId}){
   return database.transaction(async client=>{
    const item=(await client.query('SELECT * FROM support_duty_assignments WHERE id=$1 FOR UPDATE',[assignmentId])).rows[0];
    if(!item||item.status!=='pending'||item.target_user_id!==actorId)
      throw fail('support_duty_acceptance_not_found',404,'Não existe uma indicação pendente para sua conta.');
    const self=await client.query('SELECT id,role,staff_access_level,staff_sector,email_verified_at,disabled_at FROM users WHERE id=$1 FOR UPDATE',[actorId]);
    if(accepted&&!permittedTarget(self.rows[0]))throw fail('support_duty_target_ineligible',409,'Sua conta não está habilitada para essa função.');
    await consume(client,actorId,grantId);
    const status=accepted?'accepted':'declined';
    const row=(await client.query(`UPDATE support_duty_assignments SET status=$2,
      accepted_by=CASE WHEN $3 THEN $4::uuid ELSE NULL END,
      acceptance_step_up_id=CASE WHEN $3 THEN $5::uuid ELSE NULL END,
      accepted_at=CASE WHEN $3 THEN now() ELSE NULL END
      WHERE id=$1 RETURNING id,role_kind,status`,
      [assignmentId,status,accepted,actorId,grantId])).rows[0];
    await appendAudit(client,actorId,accepted?'support.duty.accepted':'support.duty.declined',assignmentId,{roleKind:item.role_kind});
    return row;
   });
  },
  revoke({actorId,assignmentId,reason,grantId}){
   return database.transaction(async client=>{
    const item=(await client.query('SELECT * FROM support_duty_assignments WHERE id=$1 FOR UPDATE',[assignmentId])).rows[0];
    if(!item||!['pending','accepted'].includes(item.status))
      throw fail('support_duty_revocation_not_found',409,'A função não está vigente.');
    const self=await actor(client,actorId);valid(self,5,'founder');
    await consume(client,actorId,grantId);
    const row=(await client.query(`UPDATE support_duty_assignments SET status='revoked',revoked_by=$2,
      revoke_step_up_id=$3,revoked_at=now(),revoke_reason=$4 WHERE id=$1
      RETURNING id,role_kind,status`,[assignmentId,actorId,grantId,reason])).rows[0];
    await appendAudit(client,actorId,'support.duty.revoked',assignmentId,{roleKind:item.role_kind,wasAccepted:item.status==='accepted'});
    return row;
   });
  },
 });
}
