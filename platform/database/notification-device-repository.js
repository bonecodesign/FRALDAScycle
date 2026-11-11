export function createNotificationDeviceRepository(database){return Object.freeze({
  async register({userId,providerReference,installationHash,verifiedAt}){const result=await database.query(`INSERT INTO notification_push_devices
    (user_id,provider_reference,installation_hash,provider_verified_at,last_seen_at)
    VALUES($1,$2,$3,$4,$4)
    ON CONFLICT(provider_reference) DO UPDATE SET last_seen_at=EXCLUDED.last_seen_at,updated_at=now()
      WHERE notification_push_devices.user_id=EXCLUDED.user_id
        AND notification_push_devices.installation_hash=EXCLUDED.installation_hash
        AND notification_push_devices.status='active'
    RETURNING id,status,created_at,updated_at`,[userId,providerReference,installationHash,verifiedAt]);
    return result.rows[0]??null;},
  async revoke({userId,deviceId}){const result=await database.query(`UPDATE notification_push_devices
    SET status='revoked',revoked_at=now(),updated_at=now()
    WHERE id=$1 AND user_id=$2 AND status='active' RETURNING id,status,revoked_at`,[deviceId,userId]);return result.rows[0]??null;},
});}
