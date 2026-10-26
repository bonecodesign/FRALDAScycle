const fail=(code,status,message)=>Object.assign(new Error(message),{code,status});

export function createAccountStepUpRepository(database){return Object.freeze({
  async account(userId){const row=(await database.query(`SELECT id,email,email_verified_at,password_hash,disabled_at
    FROM users WHERE id=$1`,[userId])).rows[0];return row??null;},

  issue({userId,purpose,challengeHash,tokenHash,code,expiresAt}){return database.transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`account-step-up:${userId}:${purpose}`]);
    const account=(await client.query(`SELECT id,email,email_verified_at,disabled_at FROM users
      WHERE id=$1 FOR NO KEY UPDATE`,[userId])).rows[0];
    if(!account||account.disabled_at)throw fail('account_unavailable',404,'Conta indisponível.');
    if(!account.email||!account.email_verified_at)throw fail('verified_email_required',409,'É necessário um e-mail verificado.');
    const recent=(await client.query(`SELECT count(*)::int AS requests,
      COALESCE(bool_or(created_at>now()-interval '60 seconds'),false) AS cooling_down
      FROM account_step_up_requests WHERE user_id=$1 AND purpose=$2
        AND created_at>now()-interval '30 minutes'`,[userId,purpose])).rows[0];
    if(recent.cooling_down||recent.requests>=5)throw fail('account_step_up_limited',429,'Aguarde antes de solicitar outro código.');
    await client.query(`UPDATE auth_tokens SET consumed_at=now() WHERE user_id=$1
      AND kind='account_step_up' AND consumed_at IS NULL`,[userId]);
    await client.query(`UPDATE account_step_up_requests SET attempts=5 WHERE user_id=$1 AND purpose=$2
      AND confirmed_at IS NULL AND attempts<5`,[userId,purpose]);
    const token=(await client.query(`INSERT INTO auth_tokens(user_id,kind,token_hash,expires_at)
      VALUES($1,'account_step_up',$2,$3) RETURNING id`,[userId,tokenHash,expiresAt])).rows[0];
    const pending=(await client.query(`INSERT INTO account_step_up_requests
      (user_id,auth_token_id,challenge_hash,purpose,expires_at) VALUES($1,$2,$3,$4,$5)
      RETURNING id`,[userId,token.id,challengeHash,purpose,expiresAt])).rows[0];
    await client.query(`INSERT INTO notification_outbox(kind,recipient,payload,auth_token_id)
      VALUES('account_step_up',$1,$2::jsonb,$3)`,[account.email,JSON.stringify({token:code,channel:'email',purpose}),token.id]);
    return pending.id;
  });},

  confirm({userId,purpose,challengeHash,tokenHash}){return database.transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`account-step-up:${userId}:${purpose}`]);
    const pending=(await client.query(`SELECT r.id,r.attempts,r.expires_at,t.id AS token_id,
        t.token_hash=$4 AS valid
      FROM account_step_up_requests r JOIN auth_tokens t ON t.id=r.auth_token_id
      WHERE r.user_id=$1 AND r.purpose=$2 AND r.challenge_hash=$3
        AND r.confirmed_at IS NULL AND r.attempts<5 AND r.expires_at>now()
        AND t.consumed_at IS NULL AND t.expires_at>now() FOR UPDATE OF r,t`,
    [userId,purpose,challengeHash,tokenHash])).rows[0];
    if(!pending)return null;
    if(!pending.valid){const attempts=pending.attempts+1;await client.query(`UPDATE account_step_up_requests
      SET attempts=$2 WHERE id=$1`,[pending.id,attempts]);if(attempts>=5)await client.query('UPDATE auth_tokens SET consumed_at=now() WHERE id=$1',[pending.token_id]);return attempts>=5?{limited:true}:null;}
    await client.query('UPDATE auth_tokens SET consumed_at=now() WHERE id=$1',[pending.token_id]);
    const grant=(await client.query(`UPDATE account_step_up_requests SET confirmed_at=now()
      WHERE id=$1 RETURNING id,purpose,confirmed_at,expires_at`,[pending.id])).rows[0];
    await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
      VALUES($1,'account.step_up.confirmed','account_step_up',$2,$3::jsonb)`,[userId,grant.id,JSON.stringify({purpose})]);
    return{grantId:grant.id,purpose:grant.purpose,verifiedAt:new Date(grant.confirmed_at).toISOString(),expiresAt:new Date(grant.expires_at).toISOString()};
  });},

  consume(client,{grantId,userId,purpose}){return client.query(`UPDATE account_step_up_requests
    SET grant_consumed_at=now() WHERE id=$1 AND user_id=$2 AND purpose=$3
      AND confirmed_at IS NOT NULL AND grant_consumed_at IS NULL AND expires_at>now()
    RETURNING confirmed_at`,[grantId,userId,purpose]).then(result=>result.rows[0]??null);},
});}
