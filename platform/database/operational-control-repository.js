const DOMAINS = Object.freeze(["global", "marketplace", "payments", "logistics", "donations", "premium"]);

export function createOperationalControlRepository(database) {
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
  });
}
