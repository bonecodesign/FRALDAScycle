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
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1
           AND s.revoked_at IS NULL
           AND s.expires_at > now()
           AND u.disabled_at IS NULL
         LIMIT 1`,
        [tokenHash],
      );
      return result.rows[0] ?? null;
    },

    async revokeSession(tokenHash) {
      const result = await database.query(
        `UPDATE sessions SET revoked_at = now()
         WHERE token_hash = $1 AND revoked_at IS NULL
         RETURNING id`,
        [tokenHash],
      );
      return result.rowCount > 0;
    },
  });
}
