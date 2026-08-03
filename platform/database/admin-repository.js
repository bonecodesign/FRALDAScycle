export function createAdminRepository(database) {
  return Object.freeze({
    async listAuditEvents({ limit = 50, offset = 0 }) {
      const result = await database.query(
        `SELECT a.id, a.actor_user_id, u.display_name AS actor_name, a.action,
                a.entity_type, a.entity_id, a.metadata, a.occurred_at
         FROM audit_events a LEFT JOIN users u ON u.id = a.actor_user_id
         ORDER BY a.occurred_at DESC, a.id DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      return result.rows;
    },

    async listUsers({ query = null, role = null, status = null, limit = 50, offset = 0 }) {
      const result = await database.query(
        `SELECT id, email, phone, display_name, role, email_verified_at,
                disabled_at, created_at, updated_at
         FROM users
         WHERE ($1::text IS NULL OR display_name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%' OR phone ILIKE '%' || $1 || '%')
           AND ($2::user_role IS NULL OR role = $2)
           AND ($3::text IS NULL OR ($3 = 'active' AND disabled_at IS NULL) OR ($3 = 'suspended' AND disabled_at IS NOT NULL))
         ORDER BY created_at DESC LIMIT $4 OFFSET $5`,
        [query, role, status, limit, offset],
      );
      return result.rows;
    },

    async setUserStatus({ actorUserId, targetUserId, status, reason }) {
      return database.transaction(async (client) => {
        const current = await client.query(
          "SELECT id, disabled_at FROM users WHERE id = $1 FOR UPDATE",
          [targetUserId],
        );
        if (!current.rows[0]) return null;
        const wasSuspended = Boolean(current.rows[0].disabled_at);
        const updated = await client.query(
          `UPDATE users SET disabled_at = CASE WHEN $2 = 'suspended' THEN COALESCE(disabled_at, now()) ELSE NULL END,
                   updated_at = now()
           WHERE id = $1
           RETURNING id, email, phone, display_name, role, email_verified_at, disabled_at, updated_at`,
          [targetUserId, status],
        );
        if (status === "suspended") {
          await client.query(
            "UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
            [targetUserId],
          );
        }
        await client.query(
          `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, $2, 'user', $3, $4::jsonb)`,
          [
            actorUserId,
            status === "suspended" ? "user.suspended" : "user.reactivated",
            targetUserId,
            JSON.stringify({ previousStatus: wasSuspended ? "suspended" : "active", newStatus: status, reason }),
          ],
        );
        return updated.rows[0];
      });
    },

    async listUserSessions({ userId, currentSessionId }) {
      const result = await database.query(
        `SELECT id, user_agent, created_at, expires_at, revoked_at,
                (id = $2::uuid) AS current
         FROM sessions
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
         ORDER BY current DESC, created_at DESC`,
        [userId, currentSessionId],
      );
      return result.rows;
    },

    async revokeOtherSessions({ actorUserId, currentSessionId }) {
      return database.transaction(async (client) => {
        const revoked = await client.query(
          `UPDATE sessions SET revoked_at = now()
           WHERE user_id = $1 AND id <> $2::uuid AND revoked_at IS NULL AND expires_at > now()
           RETURNING id`,
          [actorUserId, currentSessionId],
        );
        await client.query(
          `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, 'sessions.others.revoked', 'user', $1::text, $2::jsonb)`,
          [actorUserId, JSON.stringify({ revokedCount: revoked.rowCount })],
        );
        return revoked.rowCount;
      });
    },

    async changeUserRole({ actorUserId, targetUserId, role }) {
      return database.transaction(async (client) => {
        const current = await client.query(
          "SELECT id, role FROM users WHERE id = $1 FOR UPDATE",
          [targetUserId],
        );
        if (!current.rows[0]) return null;
        const previousRole = current.rows[0].role;
        const updated = await client.query(
          `UPDATE users SET role = $2::user_role, updated_at = now()
           WHERE id = $1 RETURNING id, email, phone, display_name, role, updated_at`,
          [targetUserId, role],
        );
        await client.query(
          `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, 'user.role.changed', 'user', $2, $3::jsonb)`,
          [actorUserId, targetUserId, JSON.stringify({ previousRole, newRole: role })],
        );
        return updated.rows[0];
      });
    },
  });
}
