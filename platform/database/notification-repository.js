export function createNotificationRepository(database) {
  return Object.freeze({
    async enqueue({ kind, recipient, payload }) {
      const result = await database.query(
        `INSERT INTO notification_outbox (kind, recipient, payload)
         VALUES ($1, $2, $3::jsonb) RETURNING id`,
        [kind, recipient, JSON.stringify(payload)],
      );
      return result.rows[0].id;
    },

    async claimBatch(limit = 20) {
      return database.transaction(async (client) => {
        const result = await client.query(
          `WITH selected AS (
             SELECT id FROM notification_outbox
             WHERE status IN ('pending', 'failed') AND available_at <= now()
               AND attempts < 8
             ORDER BY created_at
             FOR UPDATE SKIP LOCKED
             LIMIT $1
           )
           UPDATE notification_outbox n
           SET status = 'processing', locked_at = now(), attempts = attempts + 1
           FROM selected WHERE n.id = selected.id
           RETURNING n.id, n.kind, n.recipient, n.payload, n.attempts`,
          [limit],
        );
        return result.rows;
      });
    },

    async delivered(id) {
      await database.query(
        `UPDATE notification_outbox SET status = 'delivered', delivered_at = now(),
         locked_at = NULL, last_error = NULL WHERE id = $1`,
        [id],
      );
    },

    async failed(id, error, delaySeconds) {
      await database.query(
        `UPDATE notification_outbox SET status = 'failed', locked_at = NULL,
         last_error = left($2, 500), available_at = now() + ($3::text || ' seconds')::interval
         WHERE id = $1`,
        [id, error, delaySeconds],
      );
    },

    async recoverStaleLocks() {
      const result = await database.query(
        `UPDATE notification_outbox SET status = 'failed', locked_at = NULL,
         available_at = now(), last_error = 'processing lease expired'
         WHERE status = 'processing' AND locked_at < now() - interval '10 minutes'`,
      );
      return result.rowCount;
    },
  });
}
