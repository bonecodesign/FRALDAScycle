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
