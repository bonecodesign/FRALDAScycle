import { CHILD_PROFILE_CONSENT_CONTENT_HASH } from "../packages/contracts/child-age-band.js";

export function createChildProfileRepository(database) {
  return Object.freeze({
    async notices(accountId) {
      // This endpoint is exclusively for the family profile panel. Other
      // account notifications (payments, disputes, etc.) must stay isolated.
      // Expired notices are hidden; global retention cleanup belongs to a
      // separately governed maintenance job, not an account read request.
      const result = await database.query(
        `SELECT id,message,created_at FROM account_notices
         WHERE user_id=$1 AND read_at IS NULL
           AND kind IN ('child_profile_change','child_profile_age_limit','child_profile_responsibility')
           AND (expires_at IS NULL OR expires_at>now())
         ORDER BY created_at DESC,id DESC LIMIT 20`,
        [accountId],
      );
      return result.rows;
    },

    async list(accountId) {
      const result = await database.query(
        `SELECT id, birth_date, emoji, consent_version, consented_at,
                personalization_enabled,responsibility_suspended_at, version, created_at, updated_at
         FROM child_profiles WHERE account_id = $1 AND deleted_at IS NULL
         ORDER BY created_at, id`,
        [accountId],
      );
      return result.rows;
    },

    async hasActive(accountId) {
      const result = await database.query(
        `SELECT EXISTS(
           SELECT 1 FROM child_profiles
           WHERE account_id = $1 AND deleted_at IS NULL AND birth_date IS NOT NULL AND responsibility_suspended_at IS NULL
         ) AS active`,
        [accountId],
      );
      return result.rows[0]?.active === true;
    },

    async operationProfileState(accountId) {
      const result = await database.query(
        `SELECT
           EXISTS(SELECT 1 FROM child_profiles WHERE account_id=$1 AND deleted_at IS NULL AND birth_date IS NOT NULL AND responsibility_suspended_at IS NULL) AS active,
           EXISTS(SELECT 1 FROM child_profiles WHERE account_id=$1 AND deleted_at IS NULL AND responsibility_suspended_at IS NOT NULL) AS suspended,
           (SELECT lifecycle_ended_reason FROM child_profiles
            WHERE account_id=$1 AND deleted_at IS NOT NULL
            ORDER BY deleted_at DESC,id DESC LIMIT 1) AS latest_ended_reason`,
        [accountId],
      );
      const row = result.rows[0] ?? {};
      if (row.active === true) return "active";
      if (row.suspended === true) return "suspended";
      return row.latest_ended_reason === "age_limit" ? "age_limit_ended" : "missing";
    },

    async create({ accountId, birthDate, emoji, consentVersion }) {
      return database.transaction(async client => {
        await client.query(`SELECT id FROM users WHERE id=$1 FOR UPDATE`, [accountId]);
        const active = (await client.query(
          `SELECT count(*)::integer AS count FROM child_profiles WHERE account_id=$1 AND deleted_at IS NULL`,
          [accountId],
        )).rows[0]?.count ?? 0;
        if (active >= 5) return { limit: true };
        const duplicate = (await client.query(
          `SELECT 1 FROM child_profiles WHERE account_id=$1 AND emoji=$2 AND deleted_at IS NULL`,
          [accountId, emoji],
        )).rows[0];
        if (duplicate) return { emojiConflict: true };
        const row = (await client.query(
          `INSERT INTO child_profiles(account_id, birth_date, emoji, consent_version, consented_at, personalization_enabled)
           VALUES($1,$2,$3,$4,now(),true)
           RETURNING id,birth_date,emoji,consent_version,consented_at,personalization_enabled,version,created_at,updated_at`,
          [accountId, birthDate, emoji, consentVersion],
        )).rows[0];
        await client.query(
          `INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
           VALUES($1,'child_profile.created','child_profile',$2,$3::jsonb)`,
          [accountId, row.id, JSON.stringify({ consentVersion, personalizationEnabled: true })],
        );
        await client.query(
          `INSERT INTO child_profile_consent_evidence
             (account_id,child_profile_id,consent_version,content_hash,accepted_at)
           VALUES($1,$2,$3,$4,$5)`,
          [accountId,row.id,consentVersion,CHILD_PROFILE_CONSENT_CONTENT_HASH,row.consented_at],
        );
        await client.query(`INSERT INTO account_notices(user_id,kind,message,dedupe_key,expires_at) VALUES($1,'child_profile_change','Um perfil da família foi criado.',$2,now()+interval '12 months') ON CONFLICT(dedupe_key) DO NOTHING`,[accountId,`child-profile:${row.id}:created:v${row.version}`]);
        return row;
      });
    },

    async update({ accountId, profileId, expectedVersion, birthDate, emoji }) {
      return database.transaction(async client => {
        await client.query(`SELECT id FROM users WHERE id=$1 FOR UPDATE`, [accountId]);
        const current = (await client.query(
          `SELECT id,version FROM child_profiles
           WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL AND responsibility_suspended_at IS NULL FOR UPDATE`,
          [profileId, accountId],
        )).rows[0];
        if (!current) return null;
        if (current.version !== expectedVersion) return { conflict: true };
        const duplicate = (await client.query(
          `SELECT 1 FROM child_profiles WHERE account_id=$1 AND emoji=$2 AND id<>$3 AND deleted_at IS NULL`,
          [accountId, emoji, profileId],
        )).rows[0];
        if (duplicate) return { emojiConflict: true };
        const row = (await client.query(
          `UPDATE child_profiles SET birth_date=$3,emoji=$4,version=version+1,updated_at=now()
           WHERE id=$1 AND account_id=$2
           RETURNING id,birth_date,emoji,consent_version,consented_at,personalization_enabled,version,created_at,updated_at`,
          [profileId, accountId, birthDate, emoji],
        )).rows[0];
        await client.query(
          `INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
           VALUES($1,'child_profile.corrected','child_profile',$2,$3::jsonb)`,
          [accountId, profileId, JSON.stringify({ previousVersion: expectedVersion, newVersion: row.version })],
        );
        await client.query(`INSERT INTO account_notices(user_id,kind,message,dedupe_key,expires_at) VALUES($1,'child_profile_change','Um perfil da família foi atualizado.',$2,now()+interval '12 months') ON CONFLICT(dedupe_key) DO NOTHING`,[accountId,`child-profile:${row.id}:updated:v${row.version}`]);
        return row;
      });
    },

    async remove({ accountId, profileId, expectedVersion }) {
      return database.transaction(async client => {
        await client.query(`SELECT id FROM users WHERE id=$1 FOR UPDATE`, [accountId]);
        const current = (await client.query(
          `SELECT id,version FROM child_profiles
           WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL AND responsibility_suspended_at IS NULL FOR UPDATE`,
          [profileId, accountId],
        )).rows[0];
        if (!current) return null;
        if (current.version !== expectedVersion) return { conflict: true };
        const row = (await client.query(
          `UPDATE child_profiles SET birth_date=NULL,personalization_enabled=false,deleted_at=now(),version=version+1,updated_at=now()
           WHERE id=$1 AND account_id=$2 RETURNING id,version,deleted_at,personalization_enabled`,
          [profileId, accountId],
        )).rows[0];
        await client.query(
          `INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
           VALUES($1,'child_profile.removed','child_profile',$2,$3::jsonb)`,
          [accountId, profileId, JSON.stringify({ previousVersion: expectedVersion, newVersion: row.version, personalizationEnabled: false })],
        );
        await client.query(`INSERT INTO account_notices(user_id,kind,message,dedupe_key,expires_at) VALUES($1,'child_profile_change','Um perfil da família foi removido.',$2,now()+interval '12 months') ON CONFLICT(dedupe_key) DO NOTHING`,[accountId,`child-profile:${row.id}:removed:v${row.version}`]);
        return row;
      });
    },
  });
}
