export function createNotificationRepository(database) {
  return Object.freeze({
    async enqueue({ kind, recipient, payload, authTokenHash = null }) {
      if (authTokenHash) {
        const result = await database.query(
          `INSERT INTO notification_outbox (kind, recipient, payload, auth_token_id)
           SELECT $1, $2, $3::jsonb, id FROM auth_tokens
           WHERE token_hash=$4 AND kind=$1 AND consumed_at IS NULL AND expires_at>now()
           RETURNING id`, [kind, recipient, JSON.stringify(payload), authTokenHash],
        );
        return result.rows[0]?.id ?? null;
      }
      const result = await database.query(
        `INSERT INTO notification_outbox (kind, recipient, payload)
         VALUES ($1, $2, $3::jsonb) RETURNING id`,
        [kind, recipient, JSON.stringify(payload)],
      );
      return result.rows[0].id;
    },

    async claimBatch(limit = 20) {
      return database.transaction(async (client) => {
        await client.query(
          `UPDATE notification_outbox n SET payload=payload-'token'
           WHERE payload ? 'token' AND (
             status IN ('delivered','cancelled') OR attempts>=8 AND status='failed' OR
             (auth_token_id IS NOT NULL AND NOT EXISTS (
               SELECT 1 FROM auth_tokens t JOIN users u ON u.id=t.user_id
               WHERE t.id=n.auth_token_id AND t.consumed_at IS NULL
                 AND t.expires_at>now() AND u.disabled_at IS NULL)) OR
             (auth_token_id IS NULL AND created_at<now()-
               CASE WHEN kind='admin_login_mfa' THEN interval '5 minutes' ELSE interval '30 minutes' END))`,
        );
        await client.query(
          `UPDATE notification_outbox n SET status='cancelled', locked_at=NULL, claim_token=NULL,
             payload=payload-'token', last_error='authentication code unavailable'
           WHERE status IN ('pending','failed') AND (NOT (payload ? 'token') OR attempts>=8 OR
             (kind='password_recovery' AND auth_token_id IS NULL) OR
             (auth_token_id IS NOT NULL AND NOT EXISTS (
               SELECT 1 FROM auth_tokens t JOIN users u ON u.id=t.user_id
               WHERE t.id=n.auth_token_id AND t.kind=n.kind AND t.consumed_at IS NULL
                 AND t.expires_at>now() AND u.disabled_at IS NULL)))`,
        );
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
           SET status = 'processing', locked_at = now(), claim_token=gen_random_uuid(), attempts = attempts + 1
           FROM selected WHERE n.id = selected.id
           RETURNING n.id, n.kind, n.recipient, n.payload, n.attempts, n.claim_token`,
          [limit],
        );
        return result.rows;
      });
    },

    async canDeliver(id, claimToken) {
      const result = await database.query(
        `SELECT 1 FROM notification_outbox n WHERE n.id=$1 AND n.status='processing'
         AND n.claim_token=$2 AND n.locked_at>now()-interval '10 minutes' AND n.payload ? 'token'
         AND ((n.auth_token_id IS NULL AND n.kind<>'password_recovery') OR EXISTS (
           SELECT 1 FROM auth_tokens t JOIN users u ON u.id=t.user_id
           WHERE t.id=n.auth_token_id AND t.kind=n.kind AND t.consumed_at IS NULL
             AND t.expires_at>now() AND u.disabled_at IS NULL))`, [id, claimToken ?? null],
      );
      return result.rowCount > 0;
    },

    async cancelled(id, claimToken) {
      await database.query(
        `UPDATE notification_outbox SET status='cancelled', locked_at=NULL, claim_token=NULL,
           payload=payload-'token', last_error='authentication code unavailable'
         WHERE id=$1 AND status='processing' AND claim_token=$2
           AND locked_at>now()-interval '10 minutes'`, [id, claimToken ?? null],
      );
    },

    async delivered(id, claimToken) {
      await database.query(
        `UPDATE notification_outbox SET status = 'delivered', delivered_at = now(),
         locked_at = NULL, claim_token=NULL, payload=payload-'token', last_error = NULL
         WHERE id = $1 AND status='processing' AND claim_token=$2
           AND locked_at>now()-interval '10 minutes'`,
        [id, claimToken ?? null],
      );
    },

    async failed(id, error, delaySeconds, claimToken) {
      await database.query(
        `UPDATE notification_outbox SET status = CASE WHEN attempts>=8 THEN 'cancelled'::notification_status ELSE 'failed'::notification_status END,
         locked_at = NULL, claim_token=NULL,
         payload=CASE WHEN attempts>=8 THEN payload-'token' ELSE payload END,
         last_error = left($2, 500), available_at = now() + ($3::text || ' seconds')::interval
         WHERE id = $1 AND status='processing' AND claim_token=$4
           AND locked_at>now()-interval '10 minutes'`,
        [id, error, delaySeconds, claimToken ?? null],
      );
    },

    async recoverStaleLocks() {
      const result = await database.query(
        `UPDATE notification_outbox SET status = 'failed', locked_at = NULL, claim_token=NULL,
         available_at = now(), last_error = 'processing lease expired'
         WHERE status = 'processing' AND locked_at < now() - interval '10 minutes'`,
      );
      return result.rowCount;
    },
  });
}
