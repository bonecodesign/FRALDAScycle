import { ServiceError } from '../apps/api/service-error.js';

export const absentOperationalPreferences = () => ({ configured: false, version: 0, channels: null, quietHours: null, updatedAt: null });
const present = row => row ? {
  configured: true, version: row.version,
  channels: { email: row.email, sms: row.sms, push: row.push },
  quietHours: { enabled: row.quiet_enabled, start: row.quiet_start, end: row.quiet_end, timeZone: row.time_zone },
  updatedAt: row.updated_at,
} : absentOperationalPreferences();

export function createOperationalPreferenceRepository(database) {
  return Object.freeze({
    async operationalPreferences(userId) {
      const result = await database.query('SELECT * FROM account_operational_preferences WHERE user_id=$1', [userId]);
      return present(result.rows[0]);
    },
    async saveOperationalPreferences(userId, input) {
      return database.transaction(async client => {
        // Também serializa a primeira gravação: a linha de preferências pode ainda não existir.
        const user = await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
        if (!user.rows[0]) throw new ServiceError('account_not_found', 404, 'Conta não encontrada.');
        const found = await client.query('SELECT * FROM account_operational_preferences WHERE user_id=$1', [userId]);
        const current = present(found.rows[0]);
        if (current.configured && JSON.stringify(current.channels) === JSON.stringify(input.channels)
          && JSON.stringify(current.quietHours) === JSON.stringify(input.quietHours)) return { preferences: current, reused: true };
        if (current.version !== input.expectedVersion) throw new ServiceError('operational_preferences_conflict', 409, 'As preferências mudaram. Carregue novamente antes de salvar.');
        const result = await client.query(`INSERT INTO account_operational_preferences
          (user_id,email,sms,push,quiet_enabled,quiet_start,quiet_end,time_zone,version)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,1)
          ON CONFLICT(user_id) DO UPDATE SET email=EXCLUDED.email,sms=EXCLUDED.sms,push=EXCLUDED.push,
          quiet_enabled=EXCLUDED.quiet_enabled,quiet_start=EXCLUDED.quiet_start,quiet_end=EXCLUDED.quiet_end,
          time_zone=EXCLUDED.time_zone,version=account_operational_preferences.version+1,updated_at=now()
          RETURNING *`, [userId, input.channels.email, input.channels.sms, input.channels.push,
          input.quietHours.enabled, input.quietHours.start, input.quietHours.end, input.quietHours.timeZone]);
        await client.query(`INSERT INTO operational_preference_events(user_id,version,preferences)
          VALUES($1,$2,$3::jsonb)`, [userId, result.rows[0].version, JSON.stringify({ channels: input.channels, quietHours: input.quietHours })]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1::uuid,'account.operational_preferences.changed','user',$1::text,'{}'::jsonb)`, [userId]);
        return { preferences: present(result.rows[0]), reused: false };
      });
    },
  });
}
