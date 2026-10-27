export function createDataExportCollector(database){return Object.freeze({
  collect(userId){return database.transaction(async client=>{
    const account=(await client.query(`SELECT id,email,phone,display_name,role,email_verified_at,phone_verified_at,
      legal_name,adult_birth_date,responsible_truth_version,responsible_truth_declared_at,
      responsible_registration_completed_at,created_at,updated_at FROM users WHERE id=$1`,[userId])).rows[0];
    if(!account)throw Object.assign(new Error('Conta não encontrada.'),{code:'account_not_found',status:404});
    const [addresses,children,transactions,marketing,cookies,terms,security]=await Promise.all([
      client.query(`SELECT id,label,postal_code,street,number,complement,district,city,state,is_primary,created_at,updated_at
        FROM addresses WHERE user_id=$1 ORDER BY is_primary DESC,created_at`,[userId]),
      client.query(`SELECT id,birth_date,consent_version,consented_at,personalization_enabled,created_at,updated_at
        FROM child_profiles WHERE account_id=$1 AND deleted_at IS NULL ORDER BY created_at`,[userId]),
      client.query(`SELECT id,listing_id,CASE WHEN buyer_id=$1 THEN 'buyer' ELSE 'seller' END AS participation,
        status,amount_cents,created_at,updated_at FROM transactions WHERE $1 IN(buyer_id,seller_id) ORDER BY created_at`,[userId]),
      client.query(`SELECT email,sms,push,notice_version,updated_at FROM account_marketing_preferences WHERE user_id=$1`,[userId]),
      client.query(`SELECT analytics,marketing,policy_version,updated_at FROM account_cookie_preferences WHERE user_id=$1`,[userId]),
      client.query(`SELECT version,content_hash,accepted_at FROM terms_acceptances WHERE user_id=$1 ORDER BY accepted_at`,[userId]),
      client.query(`SELECT
        (SELECT count(*)::int FROM sessions WHERE user_id=$1) AS sessions_created,
        (SELECT count(*)::int FROM sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>now()) AS active_sessions,
        (SELECT max(created_at) FROM sessions WHERE user_id=$1) AS last_session_created_at`,[userId]),
    ]);
    return Object.freeze({exportedAt:new Date().toISOString(),account,addresses:addresses.rows,activeChildProfiles:children.rows,transactions:transactions.rows,consents:{marketing:marketing.rows[0]??null,cookies:cookies.rows[0]??null,terms:terms.rows},securitySummary:security.rows[0]??{sessions_created:0,active_sessions:0,last_session_created_at:null}});
  });},
});}
