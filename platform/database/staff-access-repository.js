const fail=(code,status,message)=>Object.assign(new Error(message),{code,status});
export function createStaffAccessRepository(database,{stepUpRepository}){return Object.freeze({
 list(){return database.query(`SELECT r.*,target.display_name AS target_name,target.email AS target_email,
    proposer.display_name AS proposer_name,decider.display_name AS decider_name
    FROM staff_access_change_requests r JOIN users target ON target.id=r.target_user_id
    JOIN users proposer ON proposer.id=r.proposed_by LEFT JOIN users decider ON decider.id=r.decided_by
    ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 100`).then(result=>result.rows);},
 propose({actorId,targetUserId,requestedLevel,reason,grantId}){return database.transaction(async client=>{
   const actorRow=(await client.query('SELECT id,staff_access_level FROM users WHERE id=$1 AND disabled_at IS NULL FOR UPDATE',[actorId])).rows[0];
   if(!actorRow||Number(actorRow.staff_access_level)<4)throw fail('insufficient_access_level',403,'Nível 4 ou 5 obrigatório.');
   const grant=await stepUpRepository.consume(client,{grantId,userId:actorId,purpose:'staff_access_change'});if(!grant)throw fail('staff_access_step_up_required',409,'Confirmação de segurança inválida ou expirada.');
   const targetRow=(await client.query('SELECT id,role,staff_access_level,disabled_at FROM users WHERE id=$1 FOR UPDATE',[targetUserId])).rows[0];
   if(!targetRow||targetRow.disabled_at||!targetRow.staff_access_level)throw fail('staff_account_not_found',404,'Conta interna não encontrada.');
   const actorLevel=Number(actorRow.staff_access_level),previous=Number(targetRow.staff_access_level);
   if(actorId===targetUserId||previous>=actorLevel||requestedLevel>=actorLevel||(actorLevel===4&&requestedLevel>3))throw fail('staff_access_hierarchy_violation',403,'A hierarquia não permite esta alteração.');
   const row=(await client.query(`INSERT INTO staff_access_change_requests
    (target_user_id,previous_level,requested_level,reason,proposed_by,proposal_step_up_id)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[targetUserId,previous,requestedLevel,reason,actorId,grantId])).rows[0];
   await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
    VALUES($1,'staff.access_change.proposed','staff_access_change',$2,$3::jsonb)`,[actorId,row.id,JSON.stringify({targetUserId,previousLevel:previous,requestedLevel})]);return row;
 });},
 decide({actorId,requestId,approved,reason,grantId}){return database.transaction(async client=>{
   const actor=(await client.query('SELECT id,staff_access_level FROM users WHERE id=$1 AND disabled_at IS NULL FOR UPDATE',[actorId])).rows[0];
   if(Number(actor?.staff_access_level)!==5)throw fail('founder_approval_required',403,'A autorização final exige nível 5.');
   const grant=await stepUpRepository.consume(client,{grantId,userId:actorId,purpose:'staff_access_change'});if(!grant)throw fail('staff_access_step_up_required',409,'Confirmação de segurança inválida ou expirada.');
   const request=(await client.query("SELECT * FROM staff_access_change_requests WHERE id=$1 AND status='pending' FOR UPDATE",[requestId])).rows[0];
   if(!request)throw fail('staff_access_request_not_found',404,'Solicitação pendente não encontrada.');
   if(approved){const target=(await client.query('SELECT staff_access_level FROM users WHERE id=$1 AND disabled_at IS NULL FOR UPDATE',[request.target_user_id])).rows[0];
    if(!target||Number(target.staff_access_level)!==Number(request.previous_level))throw fail('staff_access_request_conflict',409,'O nível atual mudou; rejeite e crie nova solicitação.');
    await client.query(`UPDATE users SET role=CASE WHEN $2=1 THEN 'moderator'::user_role ELSE 'admin'::user_role END,
      staff_access_level=$2,updated_at=now() WHERE id=$1`,[request.target_user_id,request.requested_level]);
    await client.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[request.target_user_id]);}
   const status=approved?'approved':'rejected';const row=(await client.query(`UPDATE staff_access_change_requests SET status=$2,decided_by=$3,
    decision_step_up_id=$4,decision_reason=$5,decided_at=now() WHERE id=$1 RETURNING *`,[requestId,status,actorId,grantId,reason])).rows[0];
   await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
    VALUES($1,$2,'staff_access_change',$3,$4::jsonb)`,[actorId,approved?'staff.access_change.approved':'staff.access_change.rejected',requestId,JSON.stringify({targetUserId:request.target_user_id,previousLevel:request.previous_level,requestedLevel:request.requested_level})]);return row;
 });},
});}
