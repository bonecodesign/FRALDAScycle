const fail=(code,status,message)=>Object.assign(new Error(message),{code,status});
const dateOnly=value=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);
export function createChildDataEmergencyAccessRepository(database){return Object.freeze({
 async list(){return(await database.query(`SELECT r.id,r.profile_id,r.account_id,r.requested_by,r.justification,r.status,r.created_at,r.decided_at,
   (SELECT count(*)::int FROM child_data_emergency_access_approvals a WHERE a.request_id=r.id AND a.approved) AS approvals
   FROM child_data_emergency_access_requests r ORDER BY r.created_at DESC,r.id DESC LIMIT 100`)).rows;},
 async request(input){return database.transaction(async client=>{
  const profile=(await client.query(`SELECT id,account_id FROM child_profiles WHERE id=$1 AND deleted_at IS NULL AND birth_date IS NOT NULL FOR UPDATE`,[input.profileId])).rows[0];
  if(!profile)return null;
  const existing=(await client.query(`SELECT id FROM child_data_emergency_access_requests WHERE profile_id=$1 AND status='pending'`,[profile.id])).rows[0];if(existing)return{conflict:true};
  const row=(await client.query(`INSERT INTO child_data_emergency_access_requests(profile_id,account_id,requested_by,justification) VALUES($1,$2,$3,$4) RETURNING *`,[profile.id,profile.account_id,input.actorId,input.justification])).rows[0];
  await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'child_data.emergency_access_requested','child_data_emergency_access',$2,$3::jsonb)`,[input.actorId,row.id,JSON.stringify({profileId:profile.id,birthDateCopied:false,approved:false})]);return row;
 });},
 async approve(input){return database.transaction(async client=>{
  const request=(await client.query(`SELECT * FROM child_data_emergency_access_requests WHERE id=$1 AND status='pending' FOR UPDATE`,[input.requestId])).rows[0];if(!request)return null;
  if(request.requested_by===input.actorId)throw fail('independent_emergency_approval_required',403,'O solicitante não pode aprovar o próprio acesso.');
  const approval=(await client.query(`INSERT INTO child_data_emergency_access_approvals(request_id,approver_id,approval_domain,approved,note) VALUES($1,$2,$3,$4,$5) RETURNING *`,[request.id,input.actorId,input.domain,input.approved,input.note])).rows[0];
  let grant=null;
  if(!input.approved)await client.query(`UPDATE child_data_emergency_access_requests SET status='rejected',decided_at=now() WHERE id=$1`,[request.id]);
  else{const approvals=(await client.query(`SELECT approval_domain,approver_id FROM child_data_emergency_access_approvals WHERE request_id=$1 AND approved=true ORDER BY approval_domain`,[request.id])).rows;
   if(approvals.length===2&&new Set(approvals.map(row=>row.approver_id)).size===2){await client.query(`UPDATE child_data_emergency_access_requests SET status='approved',decided_at=now() WHERE id=$1`,[request.id]);grant=(await client.query(`INSERT INTO child_data_emergency_access_grants(request_id,grantee_id) VALUES($1,$2) RETURNING *`,[request.id,request.requested_by])).rows[0];await client.query(`INSERT INTO account_notices(user_id,kind,message,dedupe_key,expires_at) VALUES($1,'child_data_emergency_access','Um acesso humano emergencial aos dados do perfil da família foi autorizado por 15 minutos.',$2,now()+interval '12 months') ON CONFLICT(dedupe_key) DO NOTHING`,[request.account_id,`child-data-emergency-access:${request.id}`]);}}
  await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'child_data.emergency_access_reviewed','child_data_emergency_access',$2,$3::jsonb)`,[input.actorId,request.id,JSON.stringify({domain:input.domain,approved:input.approved,grantCreated:Boolean(grant),birthDateCopied:false})]);return{approval,grant};
 });},
 async read(input){return database.transaction(async client=>{
  const row=(await client.query(`SELECT g.id AS grant_id,g.request_id,g.grantee_id,g.expires_at,r.profile_id,r.account_id,p.birth_date
    FROM child_data_emergency_access_grants g JOIN child_data_emergency_access_requests r ON r.id=g.request_id
    JOIN child_profiles p ON p.id=r.profile_id WHERE g.id=$1 AND g.grantee_id=$2 AND g.revoked_at IS NULL AND g.expires_at>now()
    AND r.status='approved' AND p.deleted_at IS NULL AND p.birth_date IS NOT NULL FOR UPDATE OF g`,[input.grantId,input.actorId])).rows[0];if(!row)return null;
  const watermark=`FraldaCycle • acesso emergencial • ${input.actorId} • ${new Date(input.now).toISOString()}`;
  await client.query(`INSERT INTO child_data_emergency_access_logs(request_id,grant_id,actor_id,profile_id,watermark) VALUES($1,$2,$3,$4,$5)`,[row.request_id,row.grant_id,input.actorId,row.profile_id,watermark]);
  await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'child_data.emergency_access_read','child_data_emergency_access',$2,$3::jsonb)`,[input.actorId,row.request_id,JSON.stringify({grantId:row.grant_id,profileId:row.profile_id,watermarked:true,birthDateCopied:false})]);
  return{profileId:row.profile_id,birthDate:dateOnly(row.birth_date),expiresAt:row.expires_at,watermark};
 });}
});}
