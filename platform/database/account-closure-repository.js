const fail=(code,status,message)=>Object.assign(new Error(message),{code,status});

function publicRequest(row,reused=false){return{request:{id:row.id,status:row.status,version:row.version,requestedAt:new Date(row.requested_at).toISOString(),cancelUntil:new Date(row.cancel_until).toISOString(),reused},automaticErasureAllowed:false};}

export function createAccountClosureRepository(database,{stepUpRepository}={}){return Object.freeze({
  request(input){return database.transaction(async client=>{
    const user=(await client.query('SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE',[input.userId])).rows[0];
    if(!user)throw fail('account_not_found',404,'Conta não encontrada.');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['account-closure:'+input.idempotencyKey]);
    const byKey=(await client.query('SELECT * FROM account_closure_requests WHERE idempotency_key=$1',[input.idempotencyKey])).rows[0];
    if(byKey){if(byKey.user_id!==input.userId||byKey.notice_version!==input.noticeVersion)throw fail('account_closure_key_conflict',409,'Chave já utilizada em outra solicitação.');return publicRequest(byKey,true);}
    const active=(await client.query("SELECT * FROM account_closure_requests WHERE user_id=$1 AND status<>'cancelled' FOR UPDATE",[input.userId])).rows[0];
    if(active)return publicRequest(active,true);
    if(!stepUpRepository)throw fail('account_closure_unavailable',503,'Encerramento de conta indisponível.');
    const grant=await stepUpRepository.consume(client,{grantId:input.stepUpGrantId,userId:input.userId,purpose:'account_closure'});
    if(!grant)throw fail('account_closure_step_up_required',403,'Confirme novamente sua senha e o código enviado por e-mail.');
    const row=(await client.query(`INSERT INTO account_closure_requests(user_id,idempotency_key,notice_version,cancel_until)
      VALUES($1,$2,$3,now()+interval '7 days') RETURNING *`,[input.userId,input.idempotencyKey,input.noticeVersion])).rows[0];
    await client.query(`INSERT INTO account_operation_restrictions(user_id,reason,closure_request_id)
      VALUES($1,'closure_pending',$2)`,[input.userId,row.id]);
    await client.query(`UPDATE premium_subscriptions SET renewal_enabled=false,renewal_cancelled_at=COALESCE(renewal_cancelled_at,now()),updated_at=now()
      WHERE user_id=$1 AND renewal_enabled=true`,[input.userId]);
    await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
      VALUES($1,'account.closure.requested','account_closure',$2,$3::jsonb)`,[input.userId,row.id,JSON.stringify({noticeVersion:input.noticeVersion,cancelUntil:new Date(row.cancel_until).toISOString()})]);
    return publicRequest(row,false);
  });},
  cancel({userId,requestId,expectedVersion}){return database.transaction(async client=>{
    const row=(await client.query('SELECT * FROM account_closure_requests WHERE id=$1 AND user_id=$2 FOR UPDATE',[requestId,userId])).rows[0];
    if(!row)throw fail('account_closure_not_found',404,'Solicitação não encontrada.');
    if(row.status==='cancelled')return publicRequest(row,true);
    if(row.version!==expectedVersion)throw fail('account_closure_version_conflict',409,'A solicitação mudou. Carregue novamente.');
    const cancelled=(await client.query(`UPDATE account_closure_requests SET status='cancelled',cancelled_at=now(),version=version+1,updated_at=now()
      WHERE id=$1 AND status='cooling_off' AND cancel_until>now() RETURNING *`,[requestId])).rows[0];
    if(!cancelled)throw fail('account_closure_cancellation_expired',409,'O prazo de cancelamento terminou; procure o suporte.');
    await client.query('DELETE FROM account_operation_restrictions WHERE user_id=$1 AND closure_request_id=$2',[userId,requestId]);
    await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
      VALUES($1,'account.closure.cancelled','account_closure',$2,'{}'::jsonb)`,[userId,requestId]);
    return publicRequest(cancelled,false);
  });},
  async status(userId){const row=(await database.query("SELECT * FROM account_closure_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1",[userId])).rows[0];return row?publicRequest(row,false):{request:null,automaticErasureAllowed:false};},
  async due(limit=50){return(await database.query(`SELECT id,user_id FROM account_closure_requests WHERE status IN ('cooling_off','awaiting_obligations') AND cancel_until<=now() ORDER BY cancel_until LIMIT $1`,[limit])).rows;},
  reviewDue({requestId,userId}){return database.transaction(async client=>{const request=(await client.query(`SELECT * FROM account_closure_requests WHERE id=$1 AND user_id=$2 AND status IN ('cooling_off','awaiting_obligations') AND cancel_until<=now() FOR UPDATE`,[requestId,userId])).rows[0];if(!request)return{changed:false};const obligations=(await client.query(`SELECT
      (SELECT count(*)::int FROM transactions WHERE $1 IN(buyer_id,seller_id) AND status NOT IN('completed','cancelled','refunded')) AS active_transactions,
      (SELECT count(*)::int FROM payment_cases pc JOIN payment_intents pi ON pi.id=pc.payment_intent_id JOIN transactions t ON t.id=pi.transaction_id WHERE $1 IN(t.buyer_id,t.seller_id) AND pc.status NOT IN('rejected','completed','failed')) AS payment_cases,
      (SELECT count(*)::int FROM support_tickets st JOIN transactions t ON t.id=st.transaction_id WHERE $1 IN(t.buyer_id,t.seller_id) AND st.status<>'resolved' AND st.category IN('cancellation','receipt_problem')) AS operational_disputes,
      (SELECT count(*)::int FROM listing_content_holds h JOIN listings l ON l.id=h.listing_id WHERE l.seller_id=$1 AND h.status IN('pending_level4','pending_level5','active')) AS content_holds,
      (SELECT count(*)::int FROM listing_content_storage_outbox o JOIN listings l ON l.id=o.listing_id WHERE l.seller_id=$1 AND o.status<>'completed') AS content_storage_actions,
      (SELECT count(*)::int FROM child_profile_responsibility_disputes d WHERE d.account_id=$1 AND d.status IN('submitted','verified')) AS family_responsibility_disputes`,[userId])).rows[0];const requiredObligationCounts=["active_transactions","payment_cases","operational_disputes","content_holds","content_storage_actions","family_responsibility_disputes"];
    // Fail closed: a missing, null, string or negative count is not evidence of zero obligations.
    const pending=requiredObligationCounts.some(name=>!Number.isSafeInteger(obligations?.[name])||obligations[name]!==0),status=pending?'awaiting_obligations':'ready_for_review';if(request.status!==status){await client.query('UPDATE account_closure_requests SET status=$2,version=version+1,updated_at=now() WHERE id=$1',[requestId,status]);await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES(NULL,'account.closure.review_state','account_closure',$1,$2::jsonb)`,[requestId,JSON.stringify({status,obligations,automaticErasureAllowed:false})]);}
    if(status==='ready_for_review'){
      const counts=(await client.query(`SELECT
        (SELECT count(*)::int FROM sessions WHERE user_id=$1) AS sessions,
        (SELECT count(*)::int FROM addresses WHERE user_id=$1) AS addresses,
        (SELECT count(*)::int FROM child_profiles WHERE account_id=$1) AS child_profiles,
        (SELECT count(*)::int FROM terms_acceptances WHERE user_id=$1) AS terms_acceptances,
        (SELECT count(*)::int FROM marketing_preference_events WHERE user_id=$1) AS marketing_events,
        (SELECT count(*)::int FROM transactions WHERE $1 IN(buyer_id,seller_id)) AS transactions,
        (SELECT count(*)::int FROM support_tickets WHERE requester_id=$1) AS support_tickets,
        (SELECT count(*)::int FROM listings WHERE seller_id=$1) AS listings,
        (SELECT count(*)::int FROM listing_media m JOIN listings l ON l.id=m.listing_id WHERE l.seller_id=$1) AS listing_media,
        (SELECT count(*)::int FROM listing_content_retention r JOIN listings l ON l.id=r.listing_id WHERE l.seller_id=$1) AS content_retention_records,
        (SELECT count(*)::int FROM listing_content_holds h JOIN listings l ON l.id=h.listing_id WHERE l.seller_id=$1) AS content_holds`,[userId])).rows[0];
      const inventory={identityAndAccess:{sessions:counts.sessions,addresses:counts.addresses,classification:'candidate_for_erasure_after_review'},family:{childProfiles:counts.child_profiles,classification:'separate_child_data_policy'},consents:{termsAcceptances:counts.terms_acceptances,marketingEvents:counts.marketing_events,classification:'mixed_retention'},marketplaceContent:{listings:counts.listings,media:counts.listing_media,retentionRecords:counts.content_retention_records,holds:counts.content_holds,classification:'operation_dispute_or_legal_hold'},legalAndFinancial:{transactions:counts.transactions,supportTickets:counts.support_tickets,classification:'statutory_or_contractual_retention'},classification:'awaiting_legal_review',classificationVersion:'FC-CLOSURE-INVENTORY-2',automaticErasureAllowed:false};
      const inserted=(await client.query(`INSERT INTO account_closure_data_inventories(closure_request_id,user_id,inventory,classification_version)
        VALUES($1,$2,$3::jsonb,'FC-CLOSURE-INVENTORY-2') ON CONFLICT(closure_request_id) DO NOTHING RETURNING id`,[requestId,userId,JSON.stringify(inventory)])).rows[0];
      if(inserted)await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
        VALUES(NULL,'account.closure.inventory_prepared','account_closure',$1,$2::jsonb)`,[requestId,JSON.stringify({inventoryId:inserted.id,policyStatus:'awaiting_legal_review',automaticErasureAllowed:false})]);
    }
    return{changed:request.status!==status,status,obligations};});},
});}
