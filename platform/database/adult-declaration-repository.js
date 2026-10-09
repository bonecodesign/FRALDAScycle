export function createAdultDeclarationRepository(database) {
  return Object.freeze({
    async status(userId) {
      const result = await database.query(
        `SELECT adult_declaration_version, adult_declared_at
         FROM users WHERE id = $1`,
        [userId],
      );
      return result.rows[0] ?? null;
    },

    async declare({ actorUserId, version }) {
      return database.transaction(async client => {
        const current = (await client.query(
          `SELECT adult_declaration_version, adult_declared_at
           FROM users WHERE id = $1 FOR UPDATE`,
          [actorUserId],
        )).rows[0];
        if (!current) return null;
        if (current.adult_declaration_version === version && current.adult_declared_at) {
          return { ...current, reused: true };
        }
        const state = (await client.query(
          `UPDATE users SET adult_declaration_version = $2, adult_declared_at = now(), updated_at = now()
           WHERE id = $1 RETURNING adult_declaration_version, adult_declared_at`,
          [actorUserId, version],
        )).rows[0];
        await client.query(
          `INSERT INTO audit_events(actor_user_id, action, entity_type, entity_id, metadata)
           VALUES($1, 'account.adult.declared', 'user', $1::text, $2::jsonb)`,
          [actorUserId, JSON.stringify({ version })],
        );
        return { ...state, reused: false };
      });
    },
  });
}
