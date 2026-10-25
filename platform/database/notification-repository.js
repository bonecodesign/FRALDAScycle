export function createNotificationRepository(database) {
  return Object.freeze({
    async enqueue({ kind, recipient, payload, authTokenHash = null, userId = null }) {
      const optionalReminder = ['payment_reminder', 'delivery_reminder', 'general_reminder'].includes(kind);
      if (optionalReminder && (!userId || !['email', 'sms', 'push'].includes(payload?.channel))) {
        throw new Error('Optional reminder requires an account and an explicit channel');
      }
      if (optionalReminder && authTokenHash) throw new Error('Optional reminders cannot be bound to authentication tokens');
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
        `INSERT INTO notification_outbox (kind, recipient, payload, recipient_user_id)
         VALUES ($1, $2, $3::jsonb, $4) RETURNING id`,
        [kind, recipient, JSON.stringify(payload), userId],
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
           WHERE status IN ('pending','failed') AND (attempts>=8 OR
             (kind IN ('email_verification','password_recovery','admin_login_mfa','admin_invitation','responsible_profile_change') AND NOT (payload ? 'token')) OR
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
           ), claimed AS (
           UPDATE notification_outbox n
           SET status = 'processing', locked_at = now(), claim_token=gen_random_uuid(), attempts = attempts + 1
           FROM selected WHERE n.id = selected.id
           RETURNING n.id, n.kind, n.recipient, n.payload, n.attempts, n.claim_token, n.recipient_user_id, n.auth_token_id
           )
           SELECT c.id,c.kind,c.recipient,c.payload,c.attempts,c.claim_token,
             COALESCE(c.recipient_user_id,t.user_id) AS preference_user_id
           FROM claimed c LEFT JOIN auth_tokens t ON t.id=c.auth_token_id`,
          [limit],
        );
        return result.rows;
      });
    },

    async operationalPreferences(userId) {
      if (!userId) return { configured: false, channels: null, quietHours: null };
      const result = await database.query(`SELECT email,sms,push,quiet_enabled,quiet_start,quiet_end,time_zone
        FROM account_operational_preferences WHERE user_id=$1`, [userId]);
      const row = result.rows[0];
      return row ? {
        configured: true,
        channels: { email: row.email, sms: row.sms, push: row.push },
        quietHours: { enabled: row.quiet_enabled, start: row.quiet_start, end: row.quiet_end, timeZone: row.time_zone },
      } : { configured: false, channels: null, quietHours: null };
    },

    async canDeliver(id, claimToken) {
      const result = await database.query(
        `SELECT 1 FROM notification_outbox n WHERE n.id=$1 AND n.status='processing'
         AND n.claim_token=$2 AND n.locked_at>now()-interval '10 minutes'
         AND ((n.kind IN ('email_verification','password_recovery','admin_login_mfa','admin_invitation','responsible_profile_change') AND n.payload ? 'token')
           OR (n.kind IN ('payment_reminder','delivery_reminder','general_reminder','account_lifecycle_notice')
             AND EXISTS (SELECT 1 FROM users recipient_owner
               WHERE recipient_owner.id=n.recipient_user_id AND recipient_owner.disabled_at IS NULL
                 AND ((n.payload->>'channel'='email' AND recipient_owner.email_verified_at IS NOT NULL
                       AND n.recipient=recipient_owner.email)
                   OR (n.payload->>'channel'='sms' AND n.kind<>'account_lifecycle_notice' AND recipient_owner.phone_verified_at IS NOT NULL
                       AND n.recipient=recipient_owner.phone)))))
         AND ((n.auth_token_id IS NULL AND n.kind NOT IN ('password_recovery','responsible_profile_change')) OR EXISTS (
           SELECT 1 FROM auth_tokens t JOIN users u ON u.id=t.user_id
           WHERE t.id=n.auth_token_id AND t.kind=n.kind AND t.consumed_at IS NULL
             AND t.expires_at>now() AND u.disabled_at IS NULL))`, [id, claimToken ?? null],
      );
      return result.rowCount > 0;
    },

    async cancelled(id, claimToken, optionalReminder = false) {
      await database.query(
        `UPDATE notification_outbox SET status='cancelled', locked_at=NULL, claim_token=NULL,
           payload=payload-'token', last_error=$3
         WHERE id=$1 AND status='processing' AND claim_token=$2
           AND locked_at>now()-interval '10 minutes'`,
        [id, claimToken ?? null, optionalReminder ? 'optional notification recipient unavailable' : 'authentication code unavailable'],
      );
    },

    async cancelledByPreference(id, claimToken) {
      await database.query(`UPDATE notification_outbox SET status='cancelled',locked_at=NULL,claim_token=NULL,
        payload=payload-'token',last_error='optional notification channel is not enabled'
        WHERE id=$1 AND status='processing' AND claim_token=$2
          AND locked_at>now()-interval '10 minutes'`, [id, claimToken ?? null]);
    },

    async defer(id, claimToken, seconds = 900) {
      if (!Number.isSafeInteger(seconds) || seconds < 60 || seconds > 86400) throw new RangeError('Invalid notification deferral');
      await database.query(`UPDATE notification_outbox SET status='pending',attempts=GREATEST(attempts-1,0),
        available_at=now()+($3::text||' seconds')::interval,locked_at=NULL,claim_token=NULL,last_error=NULL
        WHERE id=$1 AND status='processing' AND claim_token=$2
          AND locked_at>now()-interval '10 minutes'`, [id, claimToken ?? null, seconds]);
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
