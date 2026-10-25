import { persistResponsibleRegistration } from "./responsible-registration-repository.js";

async function reserveCodeRequest(client, identityHash) {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`auth-code-request:${identityHash.toString('hex')}`]);
  const recent = (await client.query(
    `SELECT count(*)::int AS requests,
            COALESCE(bool_or(attempted_at > now()-interval '60 seconds'), false) AS cooling_down
     FROM login_attempts WHERE email_hash=$1 AND attempted_at>now()-interval '30 minutes'`, [identityHash],
  )).rows[0];
  if (recent.cooling_down || recent.requests >= 5) return false;
  await client.query('INSERT INTO login_attempts(email_hash,succeeded) VALUES($1,true)', [identityHash]);
  return true;
}

async function insertTokenAndNotification(client, { userId, kind, tokenHash, expiresAt, notification = null, account }) {
  const created = await client.query(
    `INSERT INTO auth_tokens (user_id, kind, token_hash, expires_at)
     VALUES ($1, $2, $3, $4) RETURNING id`, [userId, kind, tokenHash, expiresAt],
  );
  const tokenId = created.rows[0].id;
  if (notification) {
    const recipient = account.email ?? account.phone;
    if (!recipient) throw new Error('Notification recipient is required');
    await client.query(
      `INSERT INTO notification_outbox(kind,recipient,payload,auth_token_id)
       VALUES($1,$2,$3::jsonb,$4)`,
      [kind, recipient, JSON.stringify({ token: notification.token, channel: account.email ? 'email' : 'sms' }), tokenId],
    );
  }
  return tokenId;
}

export function createAuthRepository(database) {
  return Object.freeze({
    async createInvitedUserWithVerification({ email, passwordHash, displayName, phone = null, adultDeclarationVersion, verification, invitation, responsibleRegistration = null }) {
      return database.transaction(async client => {
        const admitted = (await client.query(`SELECT id FROM pilot_invitations
          WHERE email=$1 AND token_hash=$2 AND consumed_at IS NULL AND revoked_at IS NULL
            AND expires_at>now() FOR UPDATE`, [email, invitation.tokenHash])).rows[0];
        if (!admitted) throw Object.assign(new Error('Pilot invitation unavailable'), { code: 'pilot_invitation_unavailable' });
        const result = await client.query(
          `INSERT INTO users (email, phone, password_hash, display_name, adult_declaration_version, adult_declared_at)
           VALUES ($1, $2, $3, $4, $5, now())
           RETURNING id, email, phone, display_name, role, email_verified_at, adult_declaration_version, adult_declared_at, created_at`,
          [email, phone, passwordHash, displayName, adultDeclarationVersion],
        );
        const user = result.rows[0];
        if (responsibleRegistration) await persistResponsibleRegistration(client, user.id, responsibleRegistration);
        if (verification.identityHash && !await reserveCodeRequest(client, verification.identityHash)) {
          throw Object.assign(new Error('Verification request limit reached'), { code: 'verification_request_limited' });
        }
        await insertTokenAndNotification(client, { userId: user.id, kind: 'email_verification',
          tokenHash: verification.tokenHash, expiresAt: verification.expiresAt,
          notification: { token: verification.token }, account: user });
        const consumed = await client.query(`UPDATE pilot_invitations SET consumed_by=$2,consumed_at=now()
          WHERE id=$1 AND consumed_at IS NULL AND revoked_at IS NULL RETURNING id`, [admitted.id, user.id]);
        if (consumed.rowCount !== 1) throw Object.assign(new Error('Pilot invitation unavailable'), { code: 'pilot_invitation_unavailable' });
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'pilot.invitation.consumed','pilot_invitation',$2,$3::jsonb)`,
        [user.id, admitted.id, JSON.stringify({ email })]);
        return user;
      });
    },

    async createUserWithVerification({ email, passwordHash, displayName, phone = null, adultDeclarationVersion, verification, responsibleRegistration = null }) {
      return database.transaction(async client => {
        const result = await client.query(
          `INSERT INTO users (email, phone, password_hash, display_name, adult_declaration_version, adult_declared_at)
           VALUES ($1, $2, $3, $4, $5, now())
           RETURNING id, email, phone, display_name, role, email_verified_at, adult_declaration_version, adult_declared_at, created_at`,
          [email, phone, passwordHash, displayName, adultDeclarationVersion],
        );
        const user = result.rows[0];
        if (responsibleRegistration) await persistResponsibleRegistration(client, user.id, responsibleRegistration);
        if (verification.identityHash && !await reserveCodeRequest(client, verification.identityHash)) {
          throw Object.assign(new Error('Verification request limit reached'), { code: 'verification_request_limited' });
        }
        await insertTokenAndNotification(client, { userId: user.id, kind: 'email_verification',
          tokenHash: verification.tokenHash, expiresAt: verification.expiresAt,
          notification: { token: verification.token }, account: user });
        return user;
      });
    },

    async findUserByContact({ email = null, phone = null }) {
      const result = await database.query(
        `SELECT id, email, phone, password_hash, display_name, role,
                email_verified_at, adult_declaration_version, adult_declared_at, disabled_at, created_at
         FROM users WHERE ($1::text IS NOT NULL AND email = $1)
            OR ($2::text IS NOT NULL AND phone = $2)
         LIMIT 1`,
        [email, phone],
      );
      return result.rows[0] ?? null;
    },

    async findUserById(userId) {
      const result = await database.query(
        `SELECT id, email, phone, password_hash, display_name, role,
                email_verified_at, adult_declaration_version, adult_declared_at, disabled_at, created_at
         FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      );
      return result.rows[0] ?? null;
    },

    async pilotAdmissionForUser(userId) {
      const result = await database.query(`SELECT 1 FROM pilot_invitations
        WHERE consumed_by=$1 AND consumed_at IS NOT NULL AND revoked_at IS NULL LIMIT 1`, [userId]);
      return result.rowCount > 0;
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
                u.display_name, u.role, u.email_verified_at, u.adult_declaration_version, u.adult_declared_at
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

    async reservePasswordRecoveryRequest(identityHash) {
      return database.transaction(client => reserveCodeRequest(client, identityHash));
    },

    async reserveVerificationRequest(identityHash) {
      return database.transaction(client => reserveCodeRequest(client, identityHash));
    },

    async createAuthToken({ userId, kind, tokenHash, expiresAt, notification = null }) {
      return database.transaction(async client=>{
        const account = (await client.query('SELECT id,email,phone,role,disabled_at FROM users WHERE id=$1 FOR NO KEY UPDATE',[userId])).rows[0];
        if (notification && (!account || account.disabled_at)) return null;
        if (notification && kind === 'admin_login_mfa' && !['admin','moderator'].includes(account.role)) return null;
        await client.query(
          `UPDATE auth_tokens SET consumed_at = now()
           WHERE user_id = $1 AND kind = $2 AND consumed_at IS NULL`,
          [userId, kind],
        );
        return insertTokenAndNotification(client, { userId, kind, tokenHash, expiresAt, notification, account });
      });
    },

    async confirmVerificationToken({ tokenHash, attemptHash, maxAttempts = 5 }) {
      return database.transaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`account-verification:${attemptHash.toString('hex')}`]);
        const attempts = (await client.query("SELECT count(*)::int AS attempts FROM login_attempts WHERE email_hash=$1 AND succeeded=false AND attempted_at>now()-interval '30 minutes'", [attemptHash])).rows[0].attempts;
        if (attempts >= maxAttempts) return { limited: true };
        const failed = async () => {
          await client.query('INSERT INTO login_attempts(email_hash,succeeded) VALUES($1,false)', [attemptHash]);
          return { user: null };
        };
        const candidate = (await client.query("SELECT user_id FROM auth_tokens WHERE token_hash=$1 AND kind='email_verification' AND consumed_at IS NULL AND expires_at>now()", [tokenHash])).rows[0];
        if (!candidate) return failed();
        const account = (await client.query('SELECT * FROM users WHERE id=$1 FOR NO KEY UPDATE', [candidate.user_id])).rows[0];
        if (!account || account.disabled_at) return failed();
        const consumed = await client.query("UPDATE auth_tokens SET consumed_at=now() WHERE token_hash=$1 AND kind='email_verification' AND consumed_at IS NULL AND expires_at>now() RETURNING user_id", [tokenHash]);
        if (!consumed.rowCount) return failed();
        const user = (await client.query('UPDATE users SET email_verified_at=COALESCE(email_verified_at,now()),updated_at=now() WHERE id=$1 RETURNING *', [account.id])).rows[0];
        await client.query('INSERT INTO login_attempts(email_hash,succeeded) VALUES($1,true)', [attemptHash]);
        return { user };
      });
    },

    async confirmAdminMfaSession({tokenHash,attemptHash,maxAttempts,sessionTokenHash,expiresAt,userAgent=null}){
      return database.transaction(async client=>{
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`admin-mfa:${attemptHash.toString('hex')}`]);
        const attempts=(await client.query(`SELECT count(*)::int AS attempts FROM login_attempts WHERE email_hash=$1 AND succeeded=false AND attempted_at>now()-interval '15 minutes'`,[attemptHash])).rows[0].attempts;
        if(attempts>=maxAttempts)return {limited:true};
        const candidate=(await client.query("SELECT user_id FROM auth_tokens WHERE token_hash=$1 AND kind='admin_login_mfa' AND consumed_at IS NULL AND expires_at>now()",[tokenHash])).rows[0];
        let user=null;
        if(candidate){
          const account=(await client.query('SELECT * FROM users WHERE id=$1 FOR NO KEY UPDATE',[candidate.user_id])).rows[0];
          if(account&&!account.disabled_at&&['admin','moderator'].includes(account.role)){
            const consumed=await client.query("UPDATE auth_tokens SET consumed_at=now() WHERE token_hash=$1 AND kind='admin_login_mfa' AND consumed_at IS NULL AND expires_at>now() RETURNING user_id",[tokenHash]);
            if(consumed.rows.length){
              const session=(await client.query('INSERT INTO sessions(user_id,token_hash,expires_at,user_agent) VALUES($1,$2,$3,$4) RETURNING id',[account.id,sessionTokenHash,expiresAt,userAgent])).rows[0];
              user={...account,session_id:session.id};
            }
          }
        }
        await client.query('INSERT INTO login_attempts(email_hash,succeeded) VALUES($1,$2)',[attemptHash,Boolean(user)]);
        return {user};
      });
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

    async resetPasswordWithToken({ tokenHash, passwordHash, attemptHash, maxAttempts = 5 }) {
      return database.transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`password-recovery:${attemptHash.toString('hex')}`]);
        const attempts = (await client.query(
          "SELECT count(*)::int AS attempts FROM login_attempts WHERE email_hash=$1 AND succeeded=false AND attempted_at>now()-interval '30 minutes'", [attemptHash],
        )).rows[0].attempts;
        if (attempts >= maxAttempts) return { limited: true };
        const failed = async () => {
          await client.query('INSERT INTO login_attempts(email_hash,succeeded) VALUES($1,false)', [attemptHash]);
          return null;
        };
        const candidate = (await client.query(
          "SELECT user_id FROM auth_tokens WHERE token_hash=$1 AND kind='password_recovery' AND consumed_at IS NULL AND expires_at>now()",
          [tokenHash],
        )).rows[0];
        if (!candidate) return failed();
        // Keep the same user-before-token lock order as issuance and MFA confirmation.
        const account = (await client.query(
          "SELECT id, disabled_at FROM users WHERE id=$1 FOR NO KEY UPDATE", [candidate.user_id],
        )).rows[0];
        if (!account || account.disabled_at) return failed();
        const consumed = await client.query(
          "UPDATE auth_tokens SET consumed_at=now() WHERE token_hash=$1 AND kind='password_recovery' AND consumed_at IS NULL AND expires_at>now() RETURNING user_id",
          [tokenHash],
        );
        if (!consumed.rows.length) return failed();
        const userId = account.id;
        await client.query(
          "UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1",
          [userId, passwordHash],
        );
        await client.query(
          "UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
          [userId],
        );
        await client.query(
          "UPDATE auth_tokens SET consumed_at=now() WHERE user_id=$1 AND kind IN ('password_recovery','admin_login_mfa') AND consumed_at IS NULL",
          [userId],
        );
        await client.query('INSERT INTO login_attempts(email_hash,succeeded) VALUES($1,true)', [attemptHash]);
        return userId;
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
