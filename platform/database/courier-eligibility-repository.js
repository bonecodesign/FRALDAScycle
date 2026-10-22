const fail = (code, status, message) => Object.assign(new Error(message), { code, status });

export function createCourierEligibilityRepository(database) {
  return Object.freeze({
    async claimMaintenanceTasks({ limit = 20, now }) {
      return database.transaction(async client => {
        await client.query(`UPDATE courier_eligibility_maintenance_tasks
          SET status='failed',locked_at=NULL,claim_token=NULL,scheduled_for=$1,
              last_error='processing lease expired'
          WHERE status='processing' AND locked_at<$1::timestamptz-interval '10 minutes'`, [now]);
        const result = await client.query(`WITH selected AS (
          SELECT id FROM courier_eligibility_maintenance_tasks
          WHERE status IN ('pending','failed') AND scheduled_for<=$1 AND attempts<8
          ORDER BY scheduled_for,created_at,id FOR UPDATE SKIP LOCKED LIMIT $2
        )
        UPDATE courier_eligibility_maintenance_tasks t
        SET status='processing',locked_at=$1,claim_token=gen_random_uuid(),attempts=attempts+1,last_error=NULL
        FROM selected WHERE t.id=selected.id
        RETURNING t.id,t.task_kind,t.courier_id,t.document_id,t.suspension_id,
          t.attempts,t.claim_token,t.scheduled_for`, [now, limit]);
        return result.rows;
      });
    },

    async maintenanceTaskContext(task) {
      const result = await database.query(`SELECT t.id,t.task_kind,t.courier_id,t.document_id,t.suspension_id,
        u.email,u.email_verified_at,d.encrypted_object_reference,d.status AS document_status,
        d.expires_at,d.delete_at,s.status AS suspension_status,s.support_due_at,s.supervisor_due_at
        FROM courier_eligibility_maintenance_tasks t
        JOIN users u ON u.id=t.courier_id
        LEFT JOIN courier_clearance_documents d ON d.id=t.document_id
        LEFT JOIN courier_clearance_suspensions s ON s.id=t.suspension_id
        WHERE t.id=$1 AND t.status='processing' AND t.claim_token=$2`, [task.id, task.claim_token]);
      return result.rows[0] ?? null;
    },

    async closeSupportSlaTask(task, now) {
      return database.transaction(async client => {
        const result = await client.query(`UPDATE courier_clearance_suspensions s
          SET status='closed_sla_expired',updated_at=$3
          FROM courier_eligibility_maintenance_tasks t
          WHERE t.id=$1 AND t.claim_token=$2 AND t.status='processing'
            AND s.id=t.suspension_id AND s.status='suspended'
            AND s.supervisor_due_at IS NOT NULL AND s.supervisor_due_at<$3
          RETURNING s.id`, [task.id, task.claim_token, now]);
        return { closed: result.rowCount === 1 };
      });
    },

    async completeMaintenanceTask(task, { now, outcome }) {
      return database.transaction(async client => {
        const claimed = (await client.query(`SELECT id,task_kind,document_id
          FROM courier_eligibility_maintenance_tasks
          WHERE id=$1 AND status='processing' AND claim_token=$2 FOR UPDATE`,
        [task.id, task.claim_token])).rows[0];
        if (!claimed) return false;
        if (claimed.task_kind === 'clearance_copy_delete') {
          await client.query(`UPDATE courier_clearance_documents
            SET status='deleted',deleted_at=$2 WHERE id=$1 AND status<>'deleted'`,
          [claimed.document_id, now]);
        }
        await client.query(`UPDATE courier_eligibility_maintenance_tasks
          SET status='completed',completed_at=$2,locked_at=NULL,claim_token=NULL,last_error=NULL
          WHERE id=$1`, [task.id, now]);
        await client.query(`INSERT INTO audit_events(action,entity_type,entity_id,metadata)
          VALUES('courier.eligibility.maintenance_completed','courier_eligibility_maintenance_task',$1,$2::jsonb)`,
        [task.id, JSON.stringify({ taskKind: claimed.task_kind, outcome })]);
        return true;
      });
    },

    async deferMaintenanceTask(task, { availableAt, reason }) {
      const result = await database.query(`UPDATE courier_eligibility_maintenance_tasks
        SET status='pending',attempts=GREATEST(attempts-1,0),scheduled_for=$3,
            locked_at=NULL,claim_token=NULL,last_error=$4
        WHERE id=$1 AND status='processing' AND claim_token=$2 RETURNING id`,
      [task.id, task.claim_token, availableAt, reason]);
      return Boolean(result.rows[0]);
    },

    async failMaintenanceTask(task, { availableAt, error }) {
      const result = await database.query(`UPDATE courier_eligibility_maintenance_tasks
        SET status=CASE WHEN attempts>=8 THEN 'cancelled' ELSE 'failed' END,
            scheduled_for=$3,locked_at=NULL,claim_token=NULL,last_error=left($4,500)
        WHERE id=$1 AND status='processing' AND claim_token=$2 RETURNING status`,
      [task.id, task.claim_token, availableAt, error]);
      return result.rows[0]?.status ?? null;
    },

    async scheduleMaintenanceTasks({ actorId, now }) {
      return database.transaction(async client => {
        const scheduled = {};
        const statements = [
          ["renewalNotice", `INSERT INTO courier_eligibility_maintenance_tasks
            (task_key,task_kind,courier_id,document_id,scheduled_for)
            SELECT 'renewal_notice:'||d.id,'renewal_notice',d.courier_id,d.id,$1
            FROM courier_clearance_documents d
            WHERE d.status='verified' AND d.expires_at>$1
              AND d.expires_at<=$1::timestamptz + interval '7 days'
            ON CONFLICT(task_key) DO NOTHING RETURNING id`],
          ["supportEscalation", `INSERT INTO courier_eligibility_maintenance_tasks
            (task_key,task_kind,courier_id,suspension_id,scheduled_for)
            SELECT 'support_escalation:'||s.id,'support_escalation',s.courier_id,s.id,$1
            FROM courier_clearance_suspensions s
            WHERE s.status='suspended' AND s.support_due_at IS NOT NULL
              AND s.support_due_at<=$1 AND s.supervisor_due_at>=$1
            ON CONFLICT(task_key) DO NOTHING RETURNING id`],
          ["supportClose", `INSERT INTO courier_eligibility_maintenance_tasks
            (task_key,task_kind,courier_id,suspension_id,scheduled_for)
            SELECT 'support_sla_close:'||s.id,'support_sla_close',s.courier_id,s.id,$1
            FROM courier_clearance_suspensions s
            WHERE s.status='suspended' AND s.supervisor_due_at IS NOT NULL AND s.supervisor_due_at<$1
            ON CONFLICT(task_key) DO NOTHING RETURNING id`],
          ["copyDeletion", `INSERT INTO courier_eligibility_maintenance_tasks
            (task_key,task_kind,courier_id,document_id,scheduled_for)
            SELECT 'clearance_copy_delete:'||d.id,'clearance_copy_delete',d.courier_id,d.id,$1
            FROM courier_clearance_documents d
            WHERE d.status<>'deleted' AND d.delete_at IS NOT NULL AND d.delete_at<=$1
            ON CONFLICT(task_key) DO NOTHING RETURNING id`],
        ];
        for (const [key, sql] of statements) scheduled[key] = (await client.query(sql, [now])).rows.length;
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'courier.eligibility.maintenance_scheduled','courier_eligibility_maintenance',$2,$3::jsonb)`,
        [actorId, `schedule:${now}`, JSON.stringify({ now, scheduled })]);
        return scheduled;
      });
    },

    async pendingReviewQueue({ limit = 50 } = {}) {
      const result = await database.query(`SELECT r.id AS review_id,r.review_kind,r.submitted_at,r.due_at,
        d.id AS document_id,d.courier_id,d.status AS document_status,
        p.account_status,GREATEST(0,EXTRACT(EPOCH FROM (r.due_at-now())))::integer AS seconds_remaining
        FROM courier_clearance_reviews r
        JOIN courier_clearance_documents d ON d.id=r.document_id
        JOIN courier_profiles p ON p.user_id=d.courier_id
        WHERE r.status='pending'
        ORDER BY r.due_at ASC,r.id ASC LIMIT $1`, [limit]);
      return result.rows;
    },

    async pendingSupportQueue({ limit = 50 } = {}) {
      const result = await database.query(`SELECT s.id AS suspension_id,s.courier_id,s.status,
        s.support_request_reference,s.support_opened_at,s.support_due_at,s.supervisor_due_at,
        CASE
          WHEN s.support_due_at IS NULL THEN 'awaiting_request'
          WHEN now()<=s.support_due_at THEN 'support_review'
          WHEN now()<=s.supervisor_due_at THEN 'priority_review'
          ELSE 'sla_expired'
        END AS queue_state
        FROM courier_clearance_suspensions s
        WHERE s.status='suspended'
        ORDER BY COALESCE(s.support_due_at,'infinity'::timestamptz) ASC,s.created_at ASC,s.id ASC
        LIMIT $1`, [limit]);
      return result.rows;
    },

    async status(courierId) {
      const [profile, vehicle, clearance, review, suspension] = await Promise.all([
        database.query(`SELECT user_id,account_status,identity_status,adult_confirmed_at,
          email_verified_at,phone_verified_at,payout_status,terms_version,terms_accepted_at,
          admin_approval_status,created_at,updated_at
          FROM courier_profiles WHERE user_id=$1`, [courierId]),
        database.query(`SELECT id,vehicle_type,status,driver_license_status,driver_license_expires_at,updated_at
          FROM courier_vehicles WHERE courier_id=$1 AND status IN ('pending','approved')
          ORDER BY created_at DESC LIMIT 1`, [courierId]),
        database.query(`SELECT id,status,issuer,validity_source,issued_at,expires_at,delete_at,created_at,deleted_at
          FROM courier_clearance_documents WHERE courier_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1`, [courierId]),
        database.query(`SELECT r.id,r.document_id,r.review_kind,r.status,r.submitted_at,r.due_at,r.decided_at
          FROM courier_clearance_reviews r JOIN courier_clearance_documents d ON d.id=r.document_id
          WHERE d.courier_id=$1 ORDER BY r.created_at DESC,r.id DESC LIMIT 1`, [courierId]),
        database.query(`SELECT id,status,support_opened_at,support_due_at,supervisor_due_at,released_at,updated_at
          FROM courier_clearance_suspensions WHERE courier_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1`, [courierId]),
      ]);
      if (!profile.rows[0]) return null;
      return {
        profile: profile.rows[0], vehicle: vehicle.rows[0] ?? null,
        clearance: clearance.rows[0] ?? null, review: review.rows[0] ?? null,
        suspension: suspension.rows[0] ?? null,
      };
    },

    async restrictedDocument({ actorId, documentId, purpose, requestReference }) {
      return database.transaction(async client => {
        const existing = await client.query(`SELECT document_id,actor_id,purpose
          FROM courier_clearance_access_audit WHERE request_reference=$1`, [requestReference]);
        if (existing.rows[0]) {
          const row = existing.rows[0];
          if (row.document_id !== documentId || row.actor_id !== actorId || row.purpose !== purpose) {
            throw fail('clearance_access_key_conflict', 409, 'A referência já foi usada para outro acesso.');
          }
          return { reused: true, document: null };
        }
        const result = await client.query(`SELECT d.id,d.courier_id,d.encrypted_object_reference,
          d.encryption_key_reference,d.status,d.delete_at
          FROM courier_clearance_documents d
          WHERE d.id=$1 AND d.status<>'deleted' AND d.delete_at>now()
            AND EXISTS (SELECT 1 FROM courier_clearance_reviewers r
              WHERE r.user_id=$2 AND r.revoked_at IS NULL)
          FOR SHARE`, [documentId, actorId]);
        const document = result.rows[0];
        if (!document) throw fail('clearance_document_access_denied', 403, 'Documento indisponível para este revisor.');
        await client.query(`INSERT INTO courier_clearance_access_audit
          (document_id,actor_id,purpose,request_reference) VALUES($1,$2,$3,$4)`,
        [documentId, actorId, purpose, requestReference]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'courier.clearance.restricted_access','courier_clearance_document',$2,$3::jsonb)`,
        [actorId, documentId, JSON.stringify({ purpose, requestReference })]);
        return { reused: false, document };
      });
    },

    async submitClearance(input) {
      return database.transaction(async client => {
        const profile = (await client.query(`SELECT user_id,account_status FROM courier_profiles
          WHERE user_id=$1 FOR UPDATE`, [input.courierId])).rows[0];
        if (!profile) throw fail('courier_profile_not_found', 404, 'Perfil de entregador não encontrado.');
        const previous = (await client.query(`SELECT d.id,d.status,
          EXISTS (SELECT 1 FROM courier_clearance_suspensions s
            WHERE s.courier_id=d.courier_id AND s.status='suspended') AS suspended
          FROM courier_clearance_documents d WHERE d.courier_id=$1
          ORDER BY d.created_at DESC,d.id DESC LIMIT 1 FOR UPDATE`, [input.courierId])).rows[0];
        if (input.reviewKind === 'renewal' && previous?.status !== 'verified') {
          throw fail('clearance_renewal_not_allowed', 409, 'Não existe atestado anterior verificado para renovar.');
        }
        if (input.reviewKind === 'correction' && previous?.suspended !== true) {
          throw fail('clearance_correction_not_allowed', 409, 'Não existe suspensão que permita correção.');
        }
        const document = (await client.query(`INSERT INTO courier_clearance_documents
          (courier_id,issuer,encrypted_object_reference,encryption_key_reference,access_scope,
           retention_policy_version,retention_legal_approver_id)
          VALUES($1,'police_civil',$2,$3,'courier_clearance_reviewers',$4,$5)
          RETURNING id,status,created_at`, [input.courierId, input.encryptedObjectReference,
          input.encryptionKeyReference, input.retentionPolicyVersion,
          input.retentionLegalApproverId])).rows[0];
        const review = (await client.query(`INSERT INTO courier_clearance_reviews
          (document_id,review_kind,method,submission_reference,submitted_at,due_at)
          VALUES($1,$2,'official_police_civil_channel',$3,$4,$4::timestamptz + interval '24 hours')
          RETURNING id,status,submitted_at,due_at`, [document.id, input.reviewKind,
          input.submissionReference, input.submittedAt])).rows[0];
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'courier.clearance.submitted','courier_clearance_document',$2,$3::jsonb)`,
        [input.courierId, document.id, JSON.stringify({ reviewId: review.id, reviewKind: input.reviewKind })]);
        return { document, review };
      });
    },

    async decideClearanceReview(input) {
      return database.transaction(async client => {
        const row = (await client.query(`SELECT r.id,r.status,r.review_kind,r.due_at,d.id AS document_id,d.courier_id
          FROM courier_clearance_reviews r JOIN courier_clearance_documents d ON d.id=r.document_id
          WHERE r.id=$1 AND EXISTS (SELECT 1 FROM courier_clearance_reviewers cr
            WHERE cr.user_id=$2 AND cr.revoked_at IS NULL)
          FOR UPDATE OF r,d`, [input.reviewId, input.reviewerId])).rows[0];
        if (!row) throw fail('clearance_review_access_denied', 403, 'Revisão indisponível para este responsável.');
        if (row.status !== 'pending') throw fail('clearance_review_already_decided', 409, 'A revisão já possui decisão.');
        await client.query(`UPDATE courier_clearance_reviews SET status=$2,reviewer_id=$3,
          decided_at=$4,audit_reference=$5 WHERE id=$1`,
        [input.reviewId, input.decision, input.reviewerId, input.decidedAt, input.auditReference]);
        if (input.decision === 'approved') {
          await client.query(`UPDATE courier_clearance_documents SET status='verified',
            validity_source='issuer_document',issuer_verification_reference=$2,
            issued_at=$3,expires_at=$4,delete_at=$4::timestamptz + interval '30 days'
            WHERE id=$1`, [row.document_id, input.issuerVerificationReference,
            input.issuedAt, input.expiresAt]);
        } else {
          await client.query(`UPDATE courier_clearance_documents SET status='rejected' WHERE id=$1`, [row.document_id]);
          await client.query(`UPDATE courier_profiles SET account_status='suspended',updated_at=now()
            WHERE user_id=$1`, [row.courier_id]);
          await client.query(`INSERT INTO courier_clearance_suspensions(courier_id,rejected_review_id)
            VALUES($1,$2) ON CONFLICT (courier_id) WHERE status='suspended' DO NOTHING`,
          [row.courier_id, row.id]);
        }
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'courier.clearance.review_decided','courier_clearance_review',$2,$3::jsonb)`,
        [input.reviewerId, row.id, JSON.stringify({ decision: input.decision, documentId: row.document_id })]);
        return { reviewId: row.id, documentId: row.document_id, courierId: row.courier_id,
          decision: input.decision, accountSuspended: input.decision === 'rejected' };
      });
    },

    async openSupportReleaseRequest(input) {
      return database.transaction(async client => {
        let suspension = (await client.query(`SELECT s.id,s.courier_id,s.status,s.rejected_review_id,s.support_request_reference,
          EXISTS (SELECT 1 FROM courier_clearance_documents corrected
            JOIN courier_clearance_reviews correction_review ON correction_review.document_id=corrected.id
            WHERE corrected.courier_id=s.courier_id AND corrected.status='verified'
              AND correction_review.review_kind='correction' AND correction_review.status='approved'
              AND correction_review.decided_at IS NOT NULL) AS corrected_document_approved
          FROM courier_clearance_suspensions s
          WHERE s.courier_id=$1 AND s.status IN ('suspended','closed_sla_expired')
          ORDER BY s.created_at DESC,s.id DESC LIMIT 1 FOR UPDATE`, [input.courierId])).rows[0];
        if (!suspension) throw fail('clearance_suspension_not_found', 404, 'Suspensão ativa não encontrada.');
        if (suspension.corrected_document_approved !== true) {
          throw fail('corrected_clearance_not_approved', 409, 'O documento corrigido ainda não foi aprovado.');
        }
        if (suspension.status === 'closed_sla_expired') {
          suspension = (await client.query(`INSERT INTO courier_clearance_suspensions
            (courier_id,rejected_review_id) VALUES($1,$2)
            RETURNING id,courier_id,status,rejected_review_id,support_request_reference`,
          [suspension.courier_id, suspension.rejected_review_id])).rows[0];
        }
        if (suspension.support_request_reference) {
          if (suspension.support_request_reference !== input.requestReference) {
            throw fail('support_release_request_already_open', 409, 'Já existe uma solicitação de liberação ativa.');
          }
          return { id: suspension.id, reused: true };
        }
        const updated = (await client.query(`UPDATE courier_clearance_suspensions
          SET support_request_reference=$2,support_opened_at=$3,
              support_due_at=$3::timestamptz + interval '24 hours',
              supervisor_due_at=$3::timestamptz + interval '48 hours',updated_at=now()
          WHERE id=$1 RETURNING id,status,support_opened_at,support_due_at,supervisor_due_at`,
        [suspension.id, input.requestReference, input.openedAt])).rows[0];
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'courier.clearance.support_requested','courier_clearance_suspension',$2,$3::jsonb)`,
        [input.courierId, suspension.id, JSON.stringify({ requestReference: input.requestReference })]);
        return { ...updated, reused: false };
      });
    },

    async releaseSuspension(input) {
      return database.transaction(async client => {
        const suspension = (await client.query(`SELECT id,courier_id,status,support_opened_at,
          support_due_at,supervisor_due_at FROM courier_clearance_suspensions
          WHERE id=$1 FOR UPDATE`, [input.suspensionId])).rows[0];
        if (!suspension || suspension.status !== 'suspended' || !suspension.support_opened_at) {
          throw fail('support_release_not_available', 409, 'Solicitação de liberação indisponível.');
        }
        const decidedAt = Date.parse(input.decidedAt);
        const supportDueAt = Date.parse(suspension.support_due_at);
        const supervisorDueAt = Date.parse(suspension.supervisor_due_at);
        let reviewerRole = 'support';
        if (decidedAt > supportDueAt) {
          const supervisor = (await client.query(`SELECT user_id FROM courier_clearance_support_supervisors
            WHERE user_id=$1 AND revoked_at IS NULL`, [input.reviewerId])).rows[0];
          if (!supervisor || decidedAt > supervisorDueAt) {
            throw fail('support_release_sla_expired', 409, 'O prazo desta solicitação de liberação expirou.');
          }
          reviewerRole = 'support_supervisor';
        }
        await client.query(`UPDATE courier_clearance_suspensions SET status='released',released_by=$2,
          release_reviewer_role=$3,released_at=$4,release_audit_reference=$5,updated_at=now()
          WHERE id=$1`, [suspension.id, input.reviewerId, reviewerRole, input.decidedAt, input.auditReference]);
        await client.query(`UPDATE courier_profiles p SET account_status=CASE WHEN
          p.identity_status='verified' AND p.adult_confirmed_at IS NOT NULL AND
          p.email_verified_at IS NOT NULL AND p.phone_verified_at IS NOT NULL AND
          p.payout_status='verified' AND p.terms_version='FC-COURIER-1' AND
          p.terms_accepted_at IS NOT NULL AND p.admin_approval_status='approved' AND
          EXISTS (SELECT 1 FROM courier_vehicles v WHERE v.courier_id=p.user_id AND v.status='approved') AND
          EXISTS (SELECT 1 FROM courier_clearance_documents d WHERE d.courier_id=p.user_id
            AND d.status='verified' AND d.expires_at>$2::timestamptz)
          THEN 'active' ELSE 'onboarding' END,updated_at=now() WHERE p.user_id=$1`,
        [suspension.courier_id, input.decidedAt]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'courier.clearance.suspension_released','courier_clearance_suspension',$2,$3::jsonb)`,
        [input.reviewerId, suspension.id, JSON.stringify({ reviewerRole, auditReference: input.auditReference })]);
        return { id: suspension.id, courierId: suspension.courier_id, status: 'released', reviewerRole };
      });
    },

    async closeExpiredSupportRequests({ actorId, closedAt }) {
      return database.transaction(async client => {
        const closed = await client.query(`UPDATE courier_clearance_suspensions
          SET status='closed_sla_expired',updated_at=$1
          WHERE status='suspended' AND supervisor_due_at IS NOT NULL AND supervisor_due_at<$1
          RETURNING id,courier_id`, [closedAt]);
        for (const row of closed.rows) {
          await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
            VALUES($1,'courier.clearance.support_sla_closed','courier_clearance_suspension',$2,'{}'::jsonb)`,
          [actorId, row.id]);
        }
        return { closed: closed.rows.length, suspensionIds: closed.rows.map(row => row.id) };
      });
    },
  });
}
