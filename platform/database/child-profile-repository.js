export function createChildProfileRepository(database) {
  return Object.freeze({
    async list(accountId) {
      const result = await database.query(
        `SELECT id, birth_date, consent_version, consented_at,
                personalization_enabled, version, created_at, updated_at
         FROM child_profiles WHERE account_id = $1 AND deleted_at IS NULL
         ORDER BY created_at, id`,
        [accountId],
      );
      return result.rows;
    },

    async create({ accountId, birthDate, consentVersion }) {
      return database.transaction(async client => {
        const row = (await client.query(
          `INSERT INTO child_profiles(account_id, birth_date, consent_version, consented_at, personalization_enabled)
           VALUES($1,$2,$3,now(),true)
           RETURNING id,birth_date,consent_version,consented_at,personalization_enabled,version,created_at,updated_at`,
          [accountId, birthDate, consentVersion],
        )).rows[0];
        await client.query(
          `INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
           VALUES($1,'child_profile.created','child_profile',$2,$3::jsonb)`,
          [accountId, row.id, JSON.stringify({ consentVersion, personalizationEnabled: true })],
        );
        return row;
      });
    },

    async update({ accountId, profileId, expectedVersion, birthDate }) {
      return database.transaction(async client => {
        const current = (await client.query(
          `SELECT id,version FROM child_profiles
           WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL FOR UPDATE`,
          [profileId, accountId],
        )).rows[0];
        if (!current) return null;
        if (current.version !== expectedVersion) return { conflict: true };
        const row = (await client.query(
          `UPDATE child_profiles SET birth_date=$3,version=version+1,updated_at=now()
           WHERE id=$1 AND account_id=$2
           RETURNING id,birth_date,consent_version,consented_at,personalization_enabled,version,created_at,updated_at`,
          [profileId, accountId, birthDate],
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
        const current = (await client.query(
          `SELECT id,version FROM child_profiles
           WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL FOR UPDATE`,
          [profileId, accountId],
        )).rows[0];
        if (!current) return null;
        if (current.version !== expectedVersion) return { conflict: true };
        const row = (await client.query(
          `UPDATE child_profiles SET personalization_enabled=false,deleted_at=now(),version=version+1,updated_at=now()
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
