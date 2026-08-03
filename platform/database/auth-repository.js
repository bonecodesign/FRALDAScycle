export function createAuthRepository(database) {
  return Object.freeze({
    async createUser({ email, passwordHash, displayName, phone = null }) {
      const result = await database.query(
        `INSERT INTO users (email, phone, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, phone, display_name, role, email_verified_at, created_at`,
        [email, phone, passwordHash, displayName],
      );
      return result.rows[0];
    },

    async findUserByEmail(email) {
      const result = await database.query(
        `SELECT id, email, phone, password_hash, display_name, role,
                email_verified_at, disabled_at, created_at
         FROM users WHERE email = $1 LIMIT 1`,
        [email],
      );
      return result.rows[0] ?? null;
    },

    async createSession({ userId, tokenHash, expiresAt, userAgent = null }) {
      const result = await database.query(
        `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent)
         VALUES ($1, $2, $3, $4)
         RETURNING id, expires_at, created_at`,
        [userId, tokenHash, expiresAt, userAgent],
      );
      return result.rows[0];
    },

    async findActiveSession(tokenHash) {
      const result = await database.query(
        `SELECT s.id AS session_id, s.expires_at, u.id, u.email, u.phone,
                u.display_name, u.role, u.email_verified_at
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.revoked_at IS NULL
           AND s.expires_at > now() AND u.disabled_at IS NULL LIMIT 1`,
        [tokenHash],
      );
      return result.rows[0] ?? null;
    },

    async revokeSession(tokenHash) {
      const result = await database.query(
        "UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL RETURNING id",
        [tokenHash],
      );
      return result.rowCount > 0;
    },

    async createAuthToken({ userId, kind, tokenHash, expiresAt }) {
      await database.query(
        `UPDATE auth_tokens SET consumed_at = now()
         WHERE user_id = $1 AND kind = $2 AND consumed_at IS NULL`,
        [userId, kind],
      );
      await database.query(
        `INSERT INTO auth_tokens (user_id, kind, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [userId, kind, tokenHash, expiresAt],
      );
    },

    async consumeAuthToken({ tokenHash, kind }) {
      const result = await database.query(
        `UPDATE auth_tokens SET consumed_at = now()
         WHERE token_hash = $1 AND kind = $2 AND consumed_at IS NULL AND expires_at > now()
         RETURNING user_id`,
        [tokenHash, kind],
      );
      return result.rows[0]?.user_id ?? null;
    },

    async markEmailVerified(userId) {
      const result = await database.query(
        `UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
         WHERE id = $1 RETURNING id, email, phone, display_name, role, email_verified_at`,
        [userId],
      );
      return result.rows[0] ?? null;
    },

    async replacePasswordAndRevokeSessions(userId, passwordHash) {
      return database.transaction(async (client) => {
        await client.query(
          "UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1",
          [userId, passwordHash],
        );
        await client.query(
          "UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
          [userId],
        );
      });
    },

    async recordLoginAttempt({ emailHash, succeeded }) {
      await database.query(
        "INSERT INTO login_attempts (email_hash, succeeded) VALUES ($1, $2)",
        [emailHash, succeeded],
      );
    },

    async countRecentFailedAttempts(emailHash, windowMinutes = 15) {
      const result = await database.query(
        `SELECT count(*)::integer AS attempts FROM login_attempts
         WHERE email_hash = $1 AND succeeded = false
           AND attempted_at > now() - ($2::text || ' minutes')::interval`,
        [emailHash, windowMinutes],
      );
      return result.rows[0]?.attempts ?? 0;
    },
  });
}
