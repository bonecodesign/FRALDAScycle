export function createOperationalIncidentRepository(database) {
  const select = `SELECT i.id,i.reference,i.title,i.summary,i.severity,i.domain,i.status,
    i.created_by,i.assigned_to,i.resolved_at,i.created_at,i.updated_at,i.version
    FROM operational_incidents i`;
  return Object.freeze({
    async list({ status = null, domain = null, severity = null, limit = 50 } = {}) {
      const result = await database.query(`${select}
        WHERE ($1::text IS NULL OR i.status=$1) AND ($2::text IS NULL OR i.domain=$2)
          AND ($3::text IS NULL OR i.severity=$3)
        ORDER BY CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          i.updated_at DESC LIMIT $4`, [status, domain, severity, limit]);
      return result.rows;
    },
    async detail(id) {
      const incident = (await database.query(`${select} WHERE i.id=$1`, [id])).rows[0];
      if (!incident) return null;
      const events = (await database.query(`SELECT id,actor_user_id,action,note,metadata,created_at
        FROM operational_incident_events WHERE incident_id=$1 ORDER BY id`, [id])).rows;
      return { incident, events };
    },
    async create({ actorUserId, reference, idempotencyKey, title, summary, severity, domain }) {
      return database.transaction(async client => {
        const previous = (await client.query('SELECT id FROM operational_incidents WHERE idempotency_key=$1', [idempotencyKey])).rows[0];
        if (previous) {
          const incident=(await client.query(`${select} WHERE i.id=$1`,[previous.id])).rows[0];
          const events=(await client.query(`SELECT id,actor_user_id,action,note,metadata,created_at
            FROM operational_incident_events WHERE incident_id=$1 ORDER BY id`,[previous.id])).rows;
          return {incident,events,reused:true};
        }
        const incident = (await client.query(`INSERT INTO operational_incidents
          (reference,idempotency_key,title,summary,severity,domain,created_by)
          VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [reference,idempotencyKey,title,summary,severity,domain,actorUserId])).rows[0];
        await client.query(`INSERT INTO operational_incident_events(incident_id,actor_user_id,action,note,metadata)
          VALUES($1,$2,'created',$3,$4::jsonb)`, [incident.id,actorUserId,summary,JSON.stringify({severity,domain,reference})]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'incident.created','operational_incident',$2,$3::jsonb)`,
        [actorUserId,incident.id,JSON.stringify({reference,severity,domain})]);
        if(severity==='critical')await client.query(`INSERT INTO notification_outbox(kind,recipient,payload,recipient_user_id)
          SELECT 'incident_critical_notice'::auth_token_kind,u.email,$2::jsonb,u.id FROM users u
          WHERE u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL AND (
            u.staff_access_level=5 OR EXISTS(SELECT 1 FROM incident_role_assignments r
              WHERE r.target_user_id=u.id AND r.status='accepted'))
          ON CONFLICT DO NOTHING`,[incident.id,JSON.stringify({channel:'email',incidentId:incident.id,reference,severity:'critical',domain,actionPath:`/admin/operations?incident=${incident.id}`})]);
        return { incident, events: [], reused: false };
      });
    },
    async change({ actorUserId, id, expectedVersion, action, note }) {
      return database.transaction(async client => {
        const current = (await client.query('SELECT * FROM operational_incidents WHERE id=$1 FOR UPDATE',[id])).rows[0];
        if (!current) return null;
        if (Number(current.version) !== expectedVersion) return { conflict: true, incident: current };
        let status=current.status,assigned=current.assigned_to,resolvedAt=current.resolved_at;
        if(action==='claim'){if(assigned&&assigned!==actorUserId)return{assignedConflict:true,incident:current};assigned=actorUserId;}
        if(action==='release'){if(assigned!==actorUserId)return{assignedConflict:true,incident:current};assigned=null;}
        if(action==='contain')status='contained';
        if(action==='monitor')status='monitoring';
        if(action==='resolve'){status='resolved';resolvedAt=new Date();}
        if(action==='reopen'){status='open';resolvedAt=null;}
        const eventAction={claim:'claimed',release:'released',contain:'contained',monitor:'monitoring',resolve:'resolved',reopen:'reopened',note:'note'}[action];
        const incident=(await client.query(`UPDATE operational_incidents SET status=$2,assigned_to=$3,resolved_at=$4,
          updated_at=now(),version=version+1 WHERE id=$1 RETURNING *`,[id,status,assigned,resolvedAt])).rows[0];
        await client.query(`INSERT INTO operational_incident_events(incident_id,actor_user_id,action,note,metadata)
          VALUES($1,$2,$3,$4,$5::jsonb)`,[id,actorUserId,eventAction,note,JSON.stringify({previousStatus:current.status,status,previousVersion:current.version,version:incident.version})]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,$2,'operational_incident',$3,$4::jsonb)`,[actorUserId,`incident.${eventAction}`,id,JSON.stringify({status,version:incident.version})]);
        return { incident, conflict:false };
      });
    },
  });
}
