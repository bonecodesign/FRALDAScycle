function fail(code, status, message) {
  return Object.assign(new Error(message), { code, status });
}

export function createResponsibleProfileChangeRepository(database) {
  return Object.freeze({
    async account(userId) {
      const result = await database.query(`SELECT id,email,email_verified_at,password_hash,
        responsible_registration_completed_at FROM users WHERE id=$1 AND disabled_at IS NULL`, [userId]);
      return result.rows[0] ?? null;
    },

    async issue({ userId, tokenHash, challengeHash, changeHash, expiresAt, code }) {
      return database.transaction(async client => {
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`responsible-change:${userId}`]);
        await client.query(`UPDATE auth_tokens SET consumed_at=now() WHERE user_id=$1
          AND kind='responsible_profile_change' AND consumed_at IS NULL`, [userId]);
        await client.query(`UPDATE responsible_profile_change_requests SET consumed_at=now()
          WHERE user_id=$1 AND consumed_at IS NULL`, [userId]);
        const token = (await client.query(`INSERT INTO auth_tokens(user_id,kind,token_hash,expires_at)
          VALUES($1,'responsible_profile_change',$2,$3) RETURNING id`, [userId, tokenHash, expiresAt])).rows[0];
        await client.query(`INSERT INTO responsible_profile_change_requests
          (user_id,auth_token_id,challenge_hash,change_hash,expires_at)
          VALUES($1,$2,$3,$4,$5)`, [userId, token.id, challengeHash, changeHash, expiresAt]);
        const account = (await client.query("SELECT email FROM users WHERE id=$1", [userId])).rows[0];
        if (!account?.email) throw fail("verified_email_required", 409, "É necessário um e-mail verificado.");
        await client.query(`INSERT INTO notification_outbox(kind,recipient,payload,auth_token_id)
          VALUES('responsible_profile_change',$1,$2::jsonb,$3)`,
        [account.email, JSON.stringify({ token: code, channel: "email" }), token.id]);
        return token.id;
      });
    },

    async confirm({ userId, tokenHash, challengeHash, changeHash, change }) {
      return database.transaction(async client => {
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`responsible-change:${userId}`]);
        const pending = (await client.query(`SELECT r.id,r.attempts,t.id AS token_id,
            t.token_hash=$3 AND r.change_hash=$4 AS valid
          FROM responsible_profile_change_requests r JOIN auth_tokens t ON t.id=r.auth_token_id
          WHERE r.user_id=$1 AND r.challenge_hash=$2
            AND r.consumed_at IS NULL AND t.consumed_at IS NULL
            AND r.expires_at>now() AND t.expires_at>now() FOR UPDATE OF r,t`,
        [userId, challengeHash, tokenHash, changeHash])).rows[0];
        if (!pending) return null;
        if (!pending.valid) {
          const attempts = pending.attempts + 1;
          if (attempts >= 5) {
            await client.query("UPDATE auth_tokens SET consumed_at=now() WHERE id=$1", [pending.token_id]);
            await client.query(`UPDATE responsible_profile_change_requests
              SET attempts=5,consumed_at=now() WHERE id=$1`, [pending.id]);
            return { limited: true };
          }
          await client.query("UPDATE responsible_profile_change_requests SET attempts=$2 WHERE id=$1", [pending.id, attempts]);
          return null;
        }
        await client.query(`UPDATE users SET legal_name=$2,adult_birth_date=$3,updated_at=now() WHERE id=$1`,
          [userId, change.fullName, change.birthDate]);
        await client.query("UPDATE auth_tokens SET consumed_at=now() WHERE id=$1", [pending.token_id]);
        await client.query(`UPDATE responsible_profile_change_requests
          SET consumed_at=now() WHERE id=$1`, [pending.id]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1::uuid,'account.responsible.profile.changed','user',$1::uuid::text,$2::jsonb)`,
        [userId, JSON.stringify({ fields: ["legalName", "adultBirthDate"], verification: "password_and_email_code" })]);
        return { success: true };
      });
    },
  });
}
