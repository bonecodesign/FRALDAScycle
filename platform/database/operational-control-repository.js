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
    listResumeRequests(){return database.query(`SELECT r.*,p.display_name AS proposer_name,d.display_name AS decider_name
      FROM operational_resume_requests r JOIN users p ON p.id=r.proposed_by LEFT JOIN users d ON d.id=r.decided_by
      ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 100`).then(result=>result.rows);},
    proposeResume({actorUserId,domain,reason,grantId}){return database.transaction(async client=>{
      if(!stepUpRepository)throw fail('operational_resume_step_up_unavailable',503,'Confirmação de retomada indisponível.');
      const grant=await stepUpRepository.consume(client,{grantId,userId:actorUserId,purpose:'operational_resume'});if(!grant)throw fail('operational_resume_step_up_required',409,'Confirmação de segurança inválida ou expirada.');
      const state=(await client.query('SELECT domain,paused,version FROM operational_controls WHERE domain=$1 FOR UPDATE',[domain])).rows[0];if(!state?.paused)throw fail('operational_domain_not_paused',409,'O domínio não está pausado.');
      const request=(await client.query(`INSERT INTO operational_resume_requests(domain,expected_version,reason,proposed_by,proposal_step_up_id)
        VALUES($1,$2,$3,$4,$5) RETURNING *`,[domain,state.version,reason,actorUserId,grantId])).rows[0];
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'operations.resume.proposed','operational_resume_request',$2,$3::jsonb)`,[actorUserId,request.id,JSON.stringify({domain,expectedVersion:state.version})]);return request;
    });},
    decideResume({actorUserId,requestId,approved,reason,grantId}){return database.transaction(async client=>{
      if(!stepUpRepository)throw fail('operational_resume_step_up_unavailable',503,'Confirmação de retomada indisponível.');
      const grant=await stepUpRepository.consume(client,{grantId,userId:actorUserId,purpose:'operational_resume'});if(!grant)throw fail('operational_resume_step_up_required',409,'Confirmação de segurança inválida ou expirada.');
      const request=(await client.query("SELECT * FROM operational_resume_requests WHERE id=$1 AND status='pending' FOR UPDATE",[requestId])).rows[0];if(!request)throw fail('operational_resume_request_not_found',404,'Solicitação pendente não encontrada.');
      if(request.proposed_by===actorUserId)throw fail('independent_resume_approval_required',403,'A autorização final deve ser independente da proposta.');
      let status=approved?'approved':'rejected',state=null;if(approved){const current=(await client.query('SELECT * FROM operational_controls WHERE domain=$1 FOR UPDATE',[request.domain])).rows[0];if(!current?.paused||current.version!==request.expected_version){status='superseded';}else{state=(await client.query(`UPDATE operational_controls SET paused=false,reason=$2,changed_by=$3,changed_at=now(),version=version+1 WHERE domain=$1 RETURNING *`,[request.domain,reason,actorUserId])).rows[0];}}
      const row=(await client.query(`UPDATE operational_resume_requests SET status=$2,decided_by=$3,decision_step_up_id=$4,decision_reason=$5,decided_at=now() WHERE id=$1 RETURNING *`,[requestId,status,actorUserId,grantId,reason])).rows[0];
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'operational_resume_request',$3,$4::jsonb)`,[actorUserId,status==='approved'?'operations.resume.approved':status==='rejected'?'operations.resume.rejected':'operations.resume.superseded',requestId,JSON.stringify({domain:request.domain,expectedVersion:request.expected_version})]);return{request:row,state};
    });},
  });
}
