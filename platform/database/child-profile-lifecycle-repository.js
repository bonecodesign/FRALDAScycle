export function createChildProfileLifecycleRepository(database) {
  return Object.freeze({
    async process(referenceDate = new Date()) {
      const date = new Date(referenceDate);
      if (Number.isNaN(date.getTime())) throw new TypeError("Data de referência inválida.");
      const day = date.toISOString().slice(0, 10);
      return database.transaction(async client => {
        const warnings = await client.query(
          `WITH candidates AS (
             SELECT p.id,p.account_id,p.emoji,u.email
             FROM child_profiles p JOIN users u ON u.id=p.account_id
             WHERE p.deleted_at IS NULL AND p.birth_date + interval '13 years' = $1::date + interval '30 days'
           ), inserted AS (
             INSERT INTO child_profile_lifecycle_events(profile_id,account_id,event_type)
             SELECT id,account_id,'age_limit_warning' FROM candidates
             ON CONFLICT(profile_id,event_type) DO NOTHING
             RETURNING profile_id,account_id
           ), notices AS (
             INSERT INTO account_notices(user_id,kind,message)
             SELECT i.account_id,'child_profile_age_limit','Um perfil infantil será encerrado automaticamente em 30 dias.'
             FROM inserted i RETURNING user_id
           )
           INSERT INTO notification_outbox(kind,recipient,payload,recipient_user_id)
           SELECT 'account_lifecycle_notice'::auth_token_kind,c.email,
             jsonb_build_object('channel','email','event','child_profile_age_limit_warning','emoji',c.emoji),c.account_id
           FROM candidates c JOIN inserted i ON i.profile_id=c.id
           WHERE c.email IS NOT NULL
           RETURNING id`,
          [day],
        );

        const closed = await client.query(
          `WITH candidates AS (
             SELECT p.id,p.account_id,p.emoji,p.version,u.email
             FROM child_profiles p JOIN users u ON u.id=p.account_id
             WHERE p.deleted_at IS NULL AND p.birth_date + interval '13 years' <= $1::date
             FOR UPDATE OF p
           ), inserted AS (
             INSERT INTO child_profile_lifecycle_events(profile_id,account_id,event_type)
             SELECT id,account_id,'age_limit_closed' FROM candidates
             ON CONFLICT(profile_id,event_type) DO NOTHING
             RETURNING profile_id,account_id
           ), ended AS (
             UPDATE child_profiles p SET birth_date=NULL,personalization_enabled=false,
               lifecycle_ended_reason='age_limit',deleted_at=now(),updated_at=now(),version=version+1
             FROM inserted i WHERE p.id=i.profile_id
             RETURNING p.id,p.account_id,p.emoji,p.version
           ), audited AS (
             INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
             SELECT e.account_id,'child_profile.age_limit_closed','child_profile',e.id,
               jsonb_build_object('newVersion',e.version,'reason','age_limit')
             FROM ended e RETURNING entity_id
           ), notices AS (
             INSERT INTO account_notices(user_id,kind,message)
             SELECT e.account_id,'child_profile_age_limit','Um perfil infantil foi encerrado ao atingir o limite de idade.'
             FROM ended e RETURNING user_id
           )
           INSERT INTO notification_outbox(kind,recipient,payload,recipient_user_id)
           SELECT 'account_lifecycle_notice'::auth_token_kind,c.email,
             jsonb_build_object('channel','email','event','child_profile_age_limit_closed','emoji',c.emoji),c.account_id
           FROM candidates c JOIN ended e ON e.id=c.id
           WHERE c.email IS NOT NULL
           RETURNING id`,
          [day],
        );
        return { warnings: warnings.rowCount, closed: closed.rowCount };
      });
    },
  });
}
