const fail = (code, status, message) => Object.assign(new Error(message), { code, status });

function publicInvitation(row) {
  if (!row) return null;
  const { token_hash: ignored, ...invitation } = row;
  return invitation;
}

export function createPilotInvitationRepository(database) {
  return Object.freeze({
    async issue({ actorId, email, tokenHash, purpose, expiresAt, requestReference, now }) {
      return database.transaction(async client => {
        const repeated = (await client.query(`SELECT * FROM pilot_invitations
          WHERE request_reference=$1 FOR SHARE`, [requestReference])).rows[0];
        if (repeated) {
          if (repeated.issued_by !== actorId || repeated.email !== email ||
              repeated.purpose !== purpose || new Date(repeated.expires_at).toISOString() !== expiresAt) {
            throw fail('pilot_invitation_request_conflict', 409, 'A referência já foi usada para outro convite.');
          }
          return { invitation: publicInvitation(repeated), reused: true };
        }
        const open = (await client.query(`SELECT id,expires_at FROM pilot_invitations
          WHERE email=$1 AND consumed_at IS NULL AND revoked_at IS NULL FOR UPDATE`, [email])).rows[0];
        if (open && Date.parse(open.expires_at) > Date.parse(now)) {
          throw fail('pilot_invitation_already_open', 409, 'Já existe um convite válido para este e-mail.');
        }
        if (open) await client.query(`UPDATE pilot_invitations SET revoked_by=$2,revoked_at=$3,
          revocation_reason='Convite expirado substituído por nova emissão.' WHERE id=$1`, [open.id, actorId, now]);
        const invitation = (await client.query(`INSERT INTO pilot_invitations
          (email,token_hash,purpose,issued_by,request_reference,expires_at,created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [email, tokenHash, purpose, actorId, requestReference, expiresAt, now])).rows[0];
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'pilot.invitation.issued','pilot_invitation',$2,$3::jsonb)`,
        [actorId, invitation.id, JSON.stringify({ email, expiresAt, requestReference })]);
        return { invitation: publicInvitation(invitation), reused: false };
      });
    },

    async admission({ email, tokenHash, now }) {
      const result = await database.query(`SELECT * FROM pilot_invitations
        WHERE email=$1 AND token_hash=$2 AND consumed_at IS NULL AND revoked_at IS NULL
          AND expires_at>$3 LIMIT 1`, [email, tokenHash, now]);
      return publicInvitation(result.rows[0]);
    },

    async consume({ invitationId, userId, now }) {
      return database.transaction(async client => {
        const invitation = (await client.query(`UPDATE pilot_invitations
          SET consumed_by=$2,consumed_at=$3
          WHERE id=$1 AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>$3
          RETURNING *`, [invitationId, userId, now])).rows[0];
        if (!invitation) throw fail('pilot_invitation_unavailable', 409, 'Convite inválido, expirado ou já utilizado.');
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'pilot.invitation.consumed','pilot_invitation',$2,$3::jsonb)`,
        [userId, invitation.id, JSON.stringify({ email: invitation.email })]);
        return publicInvitation(invitation);
      });
    },

    async revoke({ actorId, invitationId, reason, now }) {
      return database.transaction(async client => {
        const invitation = (await client.query(`UPDATE pilot_invitations
          SET revoked_by=$2,revoked_at=$3,revocation_reason=$4
          WHERE id=$1 AND consumed_at IS NULL AND revoked_at IS NULL RETURNING *`,
        [invitationId, actorId, now, reason])).rows[0];
        if (!invitation) throw fail('pilot_invitation_not_revocable', 409, 'Convite inexistente, consumido ou já revogado.');
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'pilot.invitation.revoked','pilot_invitation',$2,$3::jsonb)`,
        [actorId, invitation.id, JSON.stringify({ reason })]);
        return publicInvitation(invitation);
      });
    },

    async list({ limit = 50 } = {}) {
      const result = await database.query(`SELECT id,email,purpose,issued_by,request_reference,
        expires_at,consumed_by,consumed_at,revoked_by,revoked_at,revocation_reason,created_at
        FROM pilot_invitations ORDER BY created_at DESC,id DESC LIMIT $1`, [limit]);
      return result.rows;
    },
  });
}
