const DOMAINS = Object.freeze(["global", "marketplace", "payments", "refunds", "payouts", "logistics", "donations", "premium"]);

const fail=(code,status,message)=>Object.assign(new Error(message),{code,status});
export function createOperationalControlRepository(database,{stepUpRepository=null}={}) {
  return Object.freeze({
    async list() {
      const result = await database.query(
        `SELECT domain, paused, reason, changed_by, changed_at, version
         FROM operational_controls
         ORDER BY array_position($1::text[], domain)`,
        [DOMAINS],
      );
      return result.rows;
    },

    async blocked(domain) {
      const result = await database.query(
        `SELECT domain, reason, changed_at
         FROM operational_controls
         WHERE paused AND domain IN ('global', $1)
         ORDER BY CASE WHEN domain = 'global' THEN 0 ELSE 1 END
         LIMIT 1`,
        [domain],
      );
      return result.rows[0] ?? null;
    },

    async change({ actorUserId, domain, paused, reason }) {
      return database.transaction(async (client) => {
        const current = await client.query(
          `SELECT domain, paused, reason, changed_by, changed_at, version
           FROM operational_controls WHERE domain = $1 FOR UPDATE`,
          [domain],
        );
        const previous = current.rows[0];
        const updated = await client.query(
          `UPDATE operational_controls
           SET paused = $2, reason = $3, changed_by = $4, changed_at = now(), version = version + 1
           WHERE domain = $1
           RETURNING domain, paused, reason, changed_by, changed_at, version`,
          [domain, paused, reason, actorUserId],
        );
        const state = updated.rows[0];
        await client.query(
          `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, $2, 'operational_control', $3, $4::jsonb)`,
          [
            actorUserId,
            paused ? "operations.paused" : "operations.resumed",
            domain,
            JSON.stringify({
              domain,
              previousPaused: previous.paused,
              newPaused: paused,
              previousVersion: previous.version,
              newVersion: state.version,
              reason,
            }),
          ],
        );
        return state;
      });
    },
    listResumeRequests(){return database.query(`SELECT r.*,p.display_name AS proposer_name,v.display_name AS reviewer_name,d.display_name AS decider_name
      FROM operational_resume_requests r JOIN users p ON p.id=r.proposed_by LEFT JOIN users v ON v.id=r.reviewed_by LEFT JOIN users d ON d.id=r.decided_by
      ORDER BY CASE WHEN r.status IN ('pending_level4','pending_level5') THEN 0 ELSE 1 END,r.created_at DESC LIMIT 100`).then(result=>result.rows);},
    proposeResume({actorUserId,domain,reason,grantId}){return database.transaction(async client=>{
      if(!stepUpRepository)throw fail('operational_resume_step_up_unavailable',503,'Confirmação de retomada indisponível.');
      const grant=await stepUpRepository.consume(client,{grantId,userId:actorUserId,purpose:'operational_resume'});if(!grant)throw fail('operational_resume_step_up_required',409,'Confirmação de segurança inválida ou expirada.');
      const state=(await client.query('SELECT domain,paused,version FROM operational_controls WHERE domain=$1 FOR UPDATE',[domain])).rows[0];if(!state?.paused)throw fail('operational_domain_not_paused',409,'O domínio não está pausado.');
      const request=(await client.query(`INSERT INTO operational_resume_requests(domain,expected_version,reason,proposed_by,proposal_step_up_id)
        VALUES($1,$2,$3,$4,$5) RETURNING *`,[domain,state.version,reason,actorUserId,grantId])).rows[0];
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'operations.resume.proposed','operational_resume_request',$2,$3::jsonb)`,[actorUserId,request.id,JSON.stringify({domain,expectedVersion:state.version})]);return request;
    });},
    reviewResume({actorUserId,requestId,approved,reason,grantId}){return database.transaction(async client=>{
      if(!stepUpRepository)throw fail('operational_resume_step_up_unavailable',503,'Confirmação de retomada indisponível.');
      const grant=await stepUpRepository.consume(client,{grantId,userId:actorUserId,purpose:'operational_resume'});if(!grant)throw fail('operational_resume_step_up_required',409,'Confirmação de segurança inválida ou expirada.');
      const request=(await client.query("SELECT * FROM operational_resume_requests WHERE id=$1 AND status='pending_level4' FOR UPDATE",[requestId])).rows[0];if(!request)throw fail('operational_resume_request_not_found',404,'Solicitação aguardando nível 4 não encontrada.');
      if(request.proposed_by===actorUserId)throw fail('independent_resume_review_required',403,'A revisão de nível 4 deve ser independente da proposta.');
      const status=approved?'pending_level5':'rejected';
      const row=(await client.query(`UPDATE operational_resume_requests SET status=$2,reviewed_by=$3,review_step_up_id=$4,review_reason=$5,reviewed_at=now(),decided_at=CASE WHEN $2='rejected' THEN now() ELSE NULL END WHERE id=$1 RETURNING *`,[requestId,status,actorUserId,grantId,reason])).rows[0];
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'operational_resume_request',$3,$4::jsonb)`,[actorUserId,approved?'operations.resume.reviewed':'operations.resume.rejected',requestId,JSON.stringify({domain:request.domain,expectedVersion:request.expected_version,stage:'level4'})]);return{request:row,state:null};
    });},
    decideResume({actorUserId,requestId,approved,reason,grantId}){return database.transaction(async client=>{
      if(!stepUpRepository)throw fail('operational_resume_step_up_unavailable',503,'Confirmação de retomada indisponível.');
      const grant=await stepUpRepository.consume(client,{grantId,userId:actorUserId,purpose:'operational_resume'});if(!grant)throw fail('operational_resume_step_up_required',409,'Confirmação de segurança inválida ou expirada.');
      const request=(await client.query("SELECT * FROM operational_resume_requests WHERE id=$1 AND status='pending_level5' FOR UPDATE",[requestId])).rows[0];if(!request)throw fail('operational_resume_request_not_found',404,'Solicitação aguardando fundador não encontrada.');
      if(request.proposed_by===actorUserId||request.reviewed_by===actorUserId)throw fail('independent_resume_approval_required',403,'A autorização final deve ser independente da proposta e da revisão.');
      let status=approved?'approved':'rejected',state=null;if(approved){const current=(await client.query('SELECT * FROM operational_controls WHERE domain=$1 FOR UPDATE',[request.domain])).rows[0];if(!current?.paused||BigInt(current.version)!==BigInt(request.expected_version)){status='superseded';}else{
        state=(await client.query(`UPDATE operational_controls SET paused=false,reason=$2,changed_by=$3,changed_at=now(),version=version+1 WHERE domain=$1 RETURNING *`,[request.domain,reason,actorUserId])).rows[0];
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'operations.resumed','operational_control',$2,$3::jsonb)`,[actorUserId,request.domain,JSON.stringify({
          domain:request.domain,previousPaused:current.paused,newPaused:false,
          previousVersion:current.version,newVersion:state.version,reason,resumeRequestId:request.id,
        })]);
      }}
      const row=(await client.query(`UPDATE operational_resume_requests SET status=$2,decided_by=$3,decision_step_up_id=$4,decision_reason=$5,decided_at=now() WHERE id=$1 RETURNING *`,[requestId,status,actorUserId,grantId,reason])).rows[0];
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'operational_resume_request',$3,$4::jsonb)`,[actorUserId,status==='approved'?'operations.resume.approved':status==='rejected'?'operations.resume.rejected':'operations.resume.superseded',requestId,JSON.stringify({domain:request.domain,expectedVersion:request.expected_version})]);return{request:row,state};
    });},
  });
}
