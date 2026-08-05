export function createRealtimeRepository(database) {
  return Object.freeze({
    async listAfter({ afterId = 0, limit = 100 } = {}) {
      const result = await database.query(
        `SELECT id, event_type, source, entity_type, entity_id, payload, occurred_at
         FROM realtime_events
         WHERE id > $1
         ORDER BY id ASC
         LIMIT $2`,
        [afterId, Math.min(100, Math.max(1, limit))],
      );
      return result.rows;
    },
  });
}
