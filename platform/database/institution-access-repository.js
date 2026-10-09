const fail=(code,status,message)=>Object.assign(new Error(message),{code,status});
async function record(client,actor,row,reason=null){
  await client.query('INSERT INTO institution_representative_events(institution_id,user_id,actor_id,version,status,reason) VALUES($1,$2,$3,$4,$5,$6)',[row.institution_id,row.user_id,actor,row.version,row.status,reason]);
  await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'institution.representative.changed','institution',$2,$3::jsonb)`,[actor,row.institution_id,JSON.stringify({status:row.status,version:row.version})]);
}
async function institution(client,id){const row=(await client.query('SELECT id,status,representative_email FROM institutions WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw fail('institution_not_found',404,'Instituição não encontrada.');return row;}
async function identity(client,record,userId){const u=(await client.query('SELECT id,email,email_verified_at FROM users WHERE id=$1',[userId])).rows[0];
  if(!u||!u.email_verified_at||u.email.toLowerCase()!==record.representative_email.toLowerCase())throw fail('institution_representative_identity_pending',409,'Conta e e-mail verificado precisam corresponder ao representante institucional conferido.');
}
export async function verifiedInstitutionRepresentative(client,institutionId){
  return (await client.query(`SELECT r.user_id FROM institution_representatives r JOIN institutions i ON i.id=r.institution_id JOIN users u ON u.id=r.user_id
    WHERE r.institution_id=$1 AND r.status='verified' AND i.status='active' AND u.email_verified_at IS NOT NULL AND lower(u.email)=lower(i.representative_email)`,[institutionId])).rows[0]?.user_id??null;
}
export function createInstitutionAccessRepository(database){return Object.freeze({
  async list({actorId,reviewer=false}){return database.transaction(async client=>{
    const rows=await client.query(`SELECT r.institution_id,r.user_id,r.status,r.version,r.accepted_at,r.verified_at,r.updated_at,i.public_name,i.status AS institution_status FROM institution_representatives r JOIN institutions i ON i.id=r.institution_id WHERE r.user_id=$1 OR $2::boolean ORDER BY r.updated_at DESC LIMIT 100`,[actorId,reviewer]);
    await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'institution.representatives.read','institution','list','{}'::jsonb)`,[actorId]);return rows.rows;
  });},
  async assign({actorId,institutionId,userId,expectedVersion,reason}){return database.transaction(async client=>{
    const i=await institution(client,institutionId);if(actorId===userId)throw fail('institution_independent_reviewer_required',403,'Não é permitido conceder autoridade institucional a si próprio.');
    await identity(client,i,userId);
    const current=(await client.query('SELECT * FROM institution_representatives WHERE institution_id=$1 FOR UPDATE',[institutionId])).rows[0];
    if(current?.status==='pending'&&current.user_id===userId&&current.invited_by===actorId&&current.grant_reason===reason&&current.version===expectedVersion+1)return {...current,reused:true};
    if((current?.version??0)!==expectedVersion)throw fail('institution_representative_version_conflict',409,'A autorização foi atualizada; consulte novamente.');
    const row=(await client.query(`INSERT INTO institution_representatives(institution_id,user_id,status,version,invited_by,grant_reason)
      VALUES($1,$2,'pending',$3,$4,$5) ON CONFLICT(institution_id) DO UPDATE SET user_id=EXCLUDED.user_id,status='pending',version=EXCLUDED.version,invited_by=EXCLUDED.invited_by,grant_reason=EXCLUDED.grant_reason,accepted_at=NULL,verified_by=NULL,verification_reason=NULL,verified_at=NULL,updated_at=now() RETURNING institution_id,user_id,status,version`,[institutionId,userId,expectedVersion+1,actorId,reason])).rows[0];
    await record(client,actorId,row,reason);return {...row,reused:false};
  });},
  async accept({actorId,institutionId,expectedVersion}){return database.transaction(async client=>{
    const i=await institution(client,institutionId);const row=(await client.query('SELECT * FROM institution_representatives WHERE institution_id=$1 AND user_id=$2 FOR UPDATE',[institutionId,actorId])).rows[0];
    if(!row)throw fail('institution_authorization_not_found',404,'Vínculo institucional não encontrado.');
    if(['accepted','verified'].includes(row.status)&&row.version===expectedVersion+1)return {institution_id:institutionId,status:row.status,version:row.version,reused:true};
    if(row.status!=='pending'||row.version!==expectedVersion)throw fail('institution_representative_version_conflict',409,'Consulte o vínculo atual antes de aceitar.');
    await identity(client,i,actorId);
    const updated=(await client.query("UPDATE institution_representatives SET status='accepted',version=version+1,accepted_at=now(),updated_at=now() WHERE institution_id=$1 RETURNING institution_id,user_id,status,version",[institutionId])).rows[0];
    await record(client,actorId,updated);return {...updated,reused:false};
  });},
  async review({actorId,institutionId,expectedVersion,outcome,reason}){return database.transaction(async client=>{
    const i=await institution(client,institutionId),row=(await client.query('SELECT * FROM institution_representatives WHERE institution_id=$1 FOR UPDATE',[institutionId])).rows[0];
    if(!row)throw fail('institution_authorization_not_found',404,'Vínculo institucional não encontrado.');
    if(row.user_id===actorId)throw fail('institution_independent_reviewer_required',403,'Outra pessoa autorizada deve conferir a representação.');
    if(row.status===outcome&&row.version===expectedVersion+1){const event=(await client.query('SELECT actor_id,reason FROM institution_representative_events WHERE institution_id=$1 AND version=$2',[institutionId,row.version])).rows[0];if(event?.actor_id===actorId&&event.reason===reason)return {institution_id:institutionId,status:row.status,version:row.version,reused:true};}
    if(row.version!==expectedVersion)throw fail('institution_representative_version_conflict',409,'O vínculo foi atualizado; consulte novamente.');
    if(outcome==='verified'){
      if(row.status!=='accepted'||i.status!=='active')throw fail('institution_representative_not_ready',409,'A instituição precisa estar ativa e o representante deve aceitar o vínculo.');
      await identity(client,i,row.user_id);
    }else if(row.status==='revoked')throw fail('institution_representative_version_conflict',409,'O vínculo já está revogado.');
    const updated=(await client.query(`UPDATE institution_representatives SET status=$2,version=version+1,verified_by=CASE WHEN $2='verified' THEN $3 ELSE verified_by END,verification_reason=CASE WHEN $2='verified' THEN $4 ELSE verification_reason END,verified_at=CASE WHEN $2='verified' THEN now() ELSE verified_at END,updated_at=now() WHERE institution_id=$1 RETURNING institution_id,user_id,status,version`,[institutionId,outcome,actorId,reason])).rows[0];
    await record(client,actorId,updated,reason);return {...updated,reused:false};
  });},
  async brandAuthorizations({actorId,reviewer=false}){return database.transaction(async client=>{
    const result=await client.query(`SELECT a.id,a.institution_id,a.representative_id,a.purpose,a.channels,a.assets,a.notice_version,
      a.valid_from,a.valid_until,a.version,a.revoked_at,a.revocation_reason,i.public_name,
      CASE WHEN a.revoked_at IS NOT NULL THEN 'revoked' WHEN a.valid_until<=now() THEN 'expired' WHEN a.valid_from>now() THEN 'scheduled' ELSE 'active' END AS status
      FROM institution_brand_authorizations a JOIN institutions i ON i.id=a.institution_id
      WHERE a.representative_id=$1 OR $2::boolean ORDER BY a.created_at DESC LIMIT 100`,[actorId,reviewer]);
    await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
      VALUES($1,'institution.brand_authorizations.read','institution','list',$2::jsonb)`,[actorId,JSON.stringify({reviewer,count:result.rows.length})]);
    return result.rows;
  });},
  async authorizeBrand(input){return database.transaction(async client=>{
    const i=await institution(client,input.institutionId);
    if(i.status!=='active'||await verifiedInstitutionRepresentative(client,input.institutionId)!==input.actorId)throw fail('institution_brand_authority_required',403,'Somente o representante verificado de uma instituição ativa pode autorizar o uso da marca.');
    const active=(await client.query('SELECT id FROM institution_brand_authorizations WHERE institution_id=$1 AND revoked_at IS NULL FOR UPDATE',[input.institutionId])).rows[0];
    if(active)throw fail('institution_brand_authorization_active',409,'Revogue a autorização atual antes de registrar outra.');
    const row=(await client.query(`INSERT INTO institution_brand_authorizations
      (institution_id,representative_id,purpose,channels,assets,notice_version,valid_from,valid_until)
      VALUES($1,$2,$3,$4::text[],$5::text[],$6,$7,$8) RETURNING *`,[input.institutionId,input.actorId,input.purpose,input.channels,input.assets,input.noticeVersion,input.validFrom,input.validUntil])).rows[0];
    await client.query(`INSERT INTO institution_brand_authorization_events(authorization_id,actor_id,action,version) VALUES($1,$2,'authorized',$3)`,[row.id,input.actorId,row.version]);
    await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
      VALUES($1,'institution.brand.authorized','institution',$2,$3::jsonb)`,[input.actorId,input.institutionId,JSON.stringify({authorizationId:row.id,channels:input.channels,assets:input.assets,validUntil:input.validUntil,noticeVersion:input.noticeVersion})]);
    return row;
  });},
  async revokeBrand(input){return database.transaction(async client=>{
    const current=(await client.query('SELECT * FROM institution_brand_authorizations WHERE id=$1 FOR UPDATE',[input.authorizationId])).rows[0];
    if(!current)throw fail('institution_brand_authorization_not_found',404,'Autorização de marca não encontrada.');
    if(current.representative_id!==input.actorId||await verifiedInstitutionRepresentative(client,current.institution_id)!==input.actorId)throw fail('institution_brand_authority_required',403,'Somente o representante verificado pode revogar esta autorização.');
    if(current.revoked_at){if(current.revocation_reason===input.reason)return {...current,reused:true};throw fail('institution_brand_version_conflict',409,'A autorização já foi revogada.');}
    if(current.version!==input.expectedVersion)throw fail('institution_brand_version_conflict',409,'A autorização foi atualizada; consulte novamente.');
    const row=(await client.query(`UPDATE institution_brand_authorizations SET revoked_at=now(),revoked_by=$2,revocation_reason=$3,version=version+1,updated_at=now()
      WHERE id=$1 RETURNING *`,[input.authorizationId,input.actorId,input.reason])).rows[0];
    await client.query(`INSERT INTO institution_brand_authorization_events(authorization_id,actor_id,action,version,reason) VALUES($1,$2,'revoked',$3,$4)`,[row.id,input.actorId,row.version,input.reason]);
    await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
      VALUES($1,'institution.brand.revoked','institution',$2,$3::jsonb)`,[input.actorId,row.institution_id,JSON.stringify({authorizationId:row.id,version:row.version})]);
    return {...row,reused:false};
  });},
  async publicBrandAuthorization({institutionId,channel,asset}){
    const result=await database.query(`SELECT id,institution_id,purpose,channels,assets,valid_from,valid_until
      FROM institution_brand_authorizations WHERE institution_id=$1 AND revoked_at IS NULL
      AND valid_from<=now() AND valid_until>now() AND $2=ANY(channels) AND $3=ANY(assets)`,[institutionId,channel,asset]);
    return result.rows[0]??null;
  }
});}
