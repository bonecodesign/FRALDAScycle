const notice=async(client,userId,message,key)=>client.query(
  `INSERT INTO account_notices(user_id,kind,message,dedupe_key,expires_at)
   VALUES($1,'child_profile_responsibility',$2,$3,now()+interval '12 months')
   ON CONFLICT(dedupe_key) DO NOTHING`,[userId,message,key]);

export function createChildProfileResponsibilityRepository(database){return Object.freeze({
  async list(){return(await database.query(`SELECT id,profile_id,account_id,support_ticket_id,reason_code,status,plausible,outcome,
    evidence_delete_by,evidence_deleted_at,created_at,updated_at
    FROM child_profile_responsibility_disputes ORDER BY created_at DESC,id DESC LIMIT 100`)).rows;},
  async open(input){return database.transaction(async client=>{
    const profile=(await client.query(`SELECT id,account_id FROM child_profiles WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,[input.profileId])).rows[0];
    if(!profile)return null;
    const ticket=(await client.query(`SELECT id,requester_id FROM support_tickets WHERE id=$1 FOR UPDATE`,[input.supportTicketId])).rows[0];
    if(!ticket||ticket.requester_id!==profile.account_id)return{ticketMismatch:true};
    const existing=(await client.query(`SELECT id FROM child_profile_responsibility_disputes WHERE profile_id=$1 AND status IN ('submitted','verified')`,[profile.id])).rows[0];
    if(existing)return{conflict:true};
    const row=(await client.query(`INSERT INTO child_profile_responsibility_disputes
      (profile_id,account_id,support_ticket_id,reason_code,evidence_reference,opened_by)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[profile.id,profile.account_id,input.supportTicketId,input.reasonCode,input.evidenceReference,input.actorId])).rows[0];
    await client.query(`UPDATE support_tickets SET status='under_review',updated_at=now() WHERE id=$1`,[input.supportTicketId]);
    await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
      VALUES($1,'child_profile.responsibility_dispute_opened','child_profile_responsibility_dispute',$2,$3::jsonb)`,[input.actorId,row.id,JSON.stringify({reasonCode:input.reasonCode,evidenceContentStored:false,profileSuspended:false})]);
    return row;
  });},
  async verify(input){return database.transaction(async client=>{
    const dispute=(await client.query(`SELECT * FROM child_profile_responsibility_disputes WHERE id=$1 AND status='submitted' FOR UPDATE`,[input.disputeId])).rows[0];
    if(!dispute)return null;
    const status=input.plausible?'verified':'rejected';
    const row=(await client.query(`UPDATE child_profile_responsibility_disputes SET status=$2,verified_by=$3,plausible=$4,
      verification_note=$5,verified_at=now(),evidence_delete_by=CASE WHEN $4 THEN NULL ELSE now()+interval '30 days' END,updated_at=now()
      WHERE id=$1 RETURNING *`,[input.disputeId,status,input.actorId,input.plausible,input.note])).rows[0];
    if(input.plausible){
      await client.query(`UPDATE child_profiles SET responsibility_suspended_at=now(),responsibility_previous_personalization=personalization_enabled,
        personalization_enabled=false,updated_at=now() WHERE id=$1 AND deleted_at IS NULL`,[dispute.profile_id]);
      await notice(client,dispute.account_id,'Um perfil da família foi suspenso temporariamente para análise restrita.',`child-profile-responsibility:${row.id}:verified`);
    }else{
      await client.query(`UPDATE support_tickets SET status='resolved',updated_at=now() WHERE id=$1`,[dispute.support_ticket_id]);
      await notice(client,dispute.account_id,'A análise inicial do perfil da família foi encerrada sem suspensão.',`child-profile-responsibility:${row.id}:rejected`);
    }
    await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
      VALUES($1,'child_profile.responsibility_dispute_verified','child_profile_responsibility_dispute',$2,$3::jsonb)`,[input.actorId,row.id,JSON.stringify({plausible:input.plausible,profileSuspended:input.plausible,evidenceContentStored:false})]);
    return row;
  });},
  async decide(input){return database.transaction(async client=>{
    const dispute=(await client.query(`SELECT * FROM child_profile_responsibility_disputes WHERE id=$1 AND status='verified' AND plausible=true FOR UPDATE`,[input.disputeId])).rows[0];
    if(!dispute)return null;
    if(input.outcome==='restore')await client.query(`UPDATE child_profiles SET responsibility_suspended_at=NULL,
      personalization_enabled=COALESCE(responsibility_previous_personalization,false),responsibility_previous_personalization=NULL,updated_at=now()
      WHERE id=$1 AND deleted_at IS NULL`,[dispute.profile_id]);
    else await client.query(`UPDATE child_profiles SET birth_date=NULL,personalization_enabled=false,deleted_at=now(),
      responsibility_suspended_at=NULL,responsibility_previous_personalization=NULL,responsibility_ended_reason='dispute_confirmed',version=version+1,updated_at=now()
      WHERE id=$1 AND deleted_at IS NULL`,[dispute.profile_id]);
    const row=(await client.query(`UPDATE child_profile_responsibility_disputes SET status='resolved',decided_by=$2,outcome=$3,
      decision_note=$4,decided_at=now(),evidence_delete_by=now()+interval '30 days',updated_at=now() WHERE id=$1 RETURNING *`,[input.disputeId,input.actorId,input.outcome,input.note])).rows[0];
    await client.query(`UPDATE support_tickets SET status='resolved',updated_at=now() WHERE id=$1`,[dispute.support_ticket_id]);
    await notice(client,dispute.account_id,input.outcome==='restore'?'O perfil da família foi liberado após análise.':'O perfil da família foi removido após análise.',`child-profile-responsibility:${row.id}:resolved`);
    await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
      VALUES($1,'child_profile.responsibility_dispute_decided','child_profile_responsibility_dispute',$2,$3::jsonb)`,[input.actorId,row.id,JSON.stringify({outcome:input.outcome,evidenceDeleteWithinDays:30,birthDateCopied:false})]);
    return row;
  });},
  async purgeExpiredEvidence(limit=100){return database.transaction(async client=>{
    const rows=(await client.query(`WITH due AS (
      SELECT id FROM child_profile_responsibility_disputes
      WHERE evidence_deleted_at IS NULL AND evidence_delete_by<=now()
      ORDER BY evidence_delete_by,id FOR UPDATE SKIP LOCKED LIMIT $1
    ) UPDATE child_profile_responsibility_disputes d SET evidence_reference=NULL,evidence_deleted_at=now(),updated_at=now()
      FROM due WHERE d.id=due.id RETURNING d.id`,[limit])).rows;
    if(rows.length)await client.query(`INSERT INTO audit_events(action,entity_type,entity_id,metadata)
      VALUES('child_profile.responsibility_evidence_purged','retention_batch','family-responsibility-30d',$1::jsonb)`,[JSON.stringify({deletedReferences:rows.length,documentContentStored:false,retentionDays:30})]);
    return{deleted:rows.length};
  });}
});}
