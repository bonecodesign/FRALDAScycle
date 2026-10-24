export function createChildProfileRepository(database) {
  return Object.freeze({
    async notices(accountId) {
      const result = await database.query(
        `SELECT id,message,created_at FROM account_notices
         WHERE user_id=$1 AND read_at IS NULL ORDER BY created_at DESC LIMIT 20`,
        [accountId],
      );
      return result.rows;
    },

    async list(accountId) {
      const result = await database.query(
        `SELECT id, birth_date, emoji, consent_version, consented_at,
                personalization_enabled, version, created_at, updated_at
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
           WHERE account_id = $1 AND deleted_at IS NULL AND birth_date IS NOT NULL
         ) AS active`,
        [accountId],
      );
      return result.rows[0]?.active === true;
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
          [accountId, row.id, JSON.stringify({ consentVersion, emoji, personalizationEnabled: true })],
        );
        return row;
      });
    },

    async update({ accountId, profileId, expectedVersion, birthDate, emoji }) {
      return database.transaction(async client => {
        await client.query(`SELECT id FROM users WHERE id=$1 FOR UPDATE`, [accountId]);
        const current = (await client.query(
          `SELECT id,version FROM child_profiles
           WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL FOR UPDATE`,
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
        return row;
      });
    },

    async remove({ accountId, profileId, expectedVersion }) {
      return database.transaction(async client => {
        await client.query(`SELECT id FROM users WHERE id=$1 FOR UPDATE`, [accountId]);
        const current = (await client.query(
          `SELECT id,version FROM child_profiles
           WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL FOR UPDATE`,
          [profileId, accountId],
        )).rows[0];
        if (!current) return null;
        if (current.version !== expectedVersion) return { conflict: true };
        const active = (await client.query(
          `SELECT count(*)::integer AS count FROM child_profiles WHERE account_id=$1 AND deleted_at IS NULL`,
          [accountId],
        )).rows[0]?.count ?? 0;
        if (active <= 1) return { lastProfile: true };
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
        return row;
      });
    },
  });
}
