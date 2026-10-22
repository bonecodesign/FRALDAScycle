import {institutionTransitionAllowed} from "../packages/contracts/institution-status.js";
const publicColumns = `id, public_name, city, state, open_packages_accepted, accepting_donations, activated_at`;
const adminColumns = `id, submitted_by_user_id, legal_name, public_name, tax_id,
  representative_name, representative_email, city, state, address_line, postal_code,
  open_packages_accepted, accepting_donations, capacity_version, capacity_reason, capacity_changed_at, capacity_changed_by, document_keys, status, review_reason, verified_at,
  activated_at, suspended_at, created_at, updated_at`;

export function createInstitutionRepository(database) {
  return Object.freeze({
    async listActive({ state = null, city = null, limit = 50, offset = 0 }) {
      const result = await database.query(
        `SELECT ${publicColumns} FROM institutions
         WHERE status = 'active'
           AND ($1::text IS NULL OR state = $1)
           AND ($2::text IS NULL OR city ILIKE '%' || $2 || '%')
         ORDER BY public_name LIMIT $3 OFFSET $4`,
        [state, city, limit, offset],
      );
      return result.rows;
    },

    async listAdmin({ status = null, limit = 50, offset = 0 }) {
      const result = await database.query(
        `SELECT ${adminColumns} FROM institutions
         WHERE ($1::institution_status IS NULL OR status = $1)
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [status, limit, offset],
      );
      return result.rows;
    },

    async detailAdmin(institutionId) {
      const result = await database.query(
        `SELECT ${adminColumns} FROM institutions WHERE id = $1`,
        [institutionId],
      );
      return result.rows[0] ?? null;
    },

    async createApplication(input) {
      return database.transaction(async (client) => {
        const created = await client.query(
          `INSERT INTO institutions
             (submitted_by_user_id, legal_name, public_name, tax_id,
              representative_name, representative_email, city, state,
              address_line, postal_code, open_packages_accepted, document_keys)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
           RETURNING ${adminColumns}`,
          [input.submittedByUserId, input.legalName, input.publicName, input.taxId,
           input.representativeName, input.representativeEmail, input.city, input.state,
           input.addressLine, input.postalCode, input.openPackagesAccepted,
           JSON.stringify(input.documentKeys)],
        );
        const institution = created.rows[0];
        await client.query(
          `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, 'institution.application.submitted', 'institution', $2, $3::jsonb)`,
          [input.submittedByUserId, institution.id, JSON.stringify({ taxIdSuffix: input.taxId.slice(-4) })],
        );
        return institution;
      });
    },

    async changeStatus({ actorUserId, institutionId, status, reason, expectedStatus, verification = null }) {
      return database.transaction(async (client) => {
        const current = await client.query(
          "SELECT id, status FROM institutions WHERE id = $1 FOR UPDATE",
          [institutionId],
        );
        if (!current.rows[0]) return null;
        const previousStatus = current.rows[0].status;
        if(previousStatus!==expectedStatus||!institutionTransitionAllowed(previousStatus,status))throw Object.assign(new Error("A instituição foi atualizada; consulte novamente antes de analisar."),{code:"institution_status_conflict",status:409});
        const updated = await client.query(
          `UPDATE institutions SET status = $2::institution_status, review_reason = $3,
             verified_at = CASE WHEN $2 IN ('active','suspended','documents_expired') THEN COALESCE(verified_at, now()) ELSE verified_at END,
             activated_at = CASE WHEN $2 = 'active' THEN COALESCE(activated_at, now()) ELSE activated_at END,
             suspended_at = CASE WHEN $2 IN ('suspended','documents_expired') THEN now() WHEN $2 = 'active' THEN NULL ELSE suspended_at END,
             updated_at = now()
           WHERE id = $1 RETURNING ${adminColumns}`,
          [institutionId, status, reason],
        );
        if(status!=='active')await client.query(`UPDATE listings SET status='paused',updated_at=now() WHERE institution_id=$1 AND kind='donation' AND status='published'
          AND NOT EXISTS(SELECT 1 FROM transactions t WHERE t.listing_id=listings.id AND t.status NOT IN('cancelled','refunded','completed'))`,[institutionId]);
        await client.query(
          `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, 'institution.status.changed', 'institution', $2, $3::jsonb)`,
          [actorUserId, institutionId, JSON.stringify({ previousStatus, newStatus: status, reason, ...(verification ? { verification } : {}) })],
        );
        return updated.rows[0];
      });
    },

    async isActive(institutionId) {
      const result = await database.query(
        "SELECT id, open_packages_accepted FROM institutions WHERE id = $1 AND status = 'active' AND accepting_donations = true",
        [institutionId],
      );
      return result.rows[0] ?? null;
    },
  });
}

