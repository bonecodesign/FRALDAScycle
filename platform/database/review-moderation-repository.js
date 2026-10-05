const fail=(code,status,message)=>Object.assign(new Error(message),{code,status});
async function audit(client,actor,action,id,metadata={}){await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'review',$3,$4::jsonb)`,[actor,action,id,JSON.stringify(metadata)]);}
async function ticket(client,actor,subject,details,key,transactionId=null){
  const r=await client.query(`INSERT INTO support_tickets(requester_id,transaction_id,category,subject,details,idempotency_key) VALUES($1,$2,'account',$3,$4,$5) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id,protocol`,[actor,transactionId,subject,details,key]);
  if(!r.rows[0])throw fail('review_support_key_conflict',409,'O protocolo já existe; consulte o suporte.');return r.rows[0];
}
export function createReviewModerationRepository(database){return Object.freeze({
  async own(actorId){return database.transaction(async client=>{
    const result=await client.query(`SELECT r.id,r.rating,r.comment,r.visibility,r.visibility_version,r.created_at,d.reason AS review_reason
      FROM transaction_reviews r LEFT JOIN LATERAL(SELECT reason FROM review_visibility_decisions WHERE review_id=r.id ORDER BY version DESC LIMIT 1)d ON true WHERE r.author_id=$1 ORDER BY r.created_at DESC LIMIT 100`,[actorId]);
    await audit(client,actorId,'reviews.own.read','list');return result.rows;
  });},
  async list(actorId){return database.transaction(async client=>{
    const result=await client.query(`SELECT r.id,r.visibility,r.visibility_version,r.created_at,(SELECT count(*)::int FROM review_reports WHERE review_id=r.id) AS report_count FROM transaction_reviews r WHERE EXISTS(SELECT 1 FROM review_reports p WHERE p.review_id=r.id) OR r.visibility<>'public' ORDER BY r.created_at DESC LIMIT 100`);
    await audit(client,actorId,'reviews.moderation.listed','list');return result.rows;
  });},
  async detail(actorId,reviewId){return database.transaction(async client=>{
    const r=(await client.query('SELECT id,transaction_id,author_id,subject_id,rating,comment,visibility,visibility_version FROM transaction_reviews WHERE id=$1',[reviewId])).rows[0];
    if(!r)throw fail('review_not_found',404,'Avaliação não encontrada.');
    const reports=await client.query('SELECT id,category,details,created_at FROM review_reports WHERE review_id=$1 ORDER BY created_at',[reviewId]);
    const decisions=await client.query('SELECT version,outcome,reason,created_at FROM review_visibility_decisions WHERE review_id=$1 ORDER BY version DESC',[reviewId]);
    await audit(client,actorId,'review.moderation.read',reviewId);delete r.author_id;delete r.subject_id;delete r.transaction_id;return {...r,reports:reports.rows,decisions:decisions.rows};
  });},
  async report({actorId,reviewId,category,details}){return database.transaction(async client=>{
    const r=(await client.query('SELECT id,visibility,visibility_version FROM transaction_reviews WHERE id=$1 FOR UPDATE',[reviewId])).rows[0];
    if(!r)throw fail('review_not_found',404,'Avaliação não encontrada.');
    const previous=(await client.query('SELECT p.*,st.protocol FROM review_reports p JOIN support_tickets st ON st.id=p.ticket_id WHERE p.review_id=$1 AND p.reporter_id=$2',[reviewId,actorId])).rows[0];
    if(previous){if(previous.category!==category||previous.details!==details)throw fail('review_report_conflict',409,'A denúncia já foi registrada; acompanhe seu protocolo.');return {id:previous.id,protocol:previous.protocol,reused:true};}
    if(r.visibility==='removed')throw fail('review_not_public',409,'A avaliação já está removida da consulta pública.');
    const support=await ticket(client,actorId,'Denúncia de avaliação',details,'review-report:'+reviewId+':'+actorId);
    const report=(await client.query('INSERT INTO review_reports(review_id,reporter_id,category,details,ticket_id) VALUES($1,$2,$3,$4,$5) RETURNING id',[reviewId,actorId,category,details,support.id])).rows[0];
    if(r.visibility==='public')await client.query("UPDATE transaction_reviews SET visibility='under_review',visibility_version=visibility_version+1 WHERE id=$1",[reviewId]);
    await audit(client,actorId,'review.reported',reviewId,{category});return {id:report.id,protocol:support.protocol,reused:false};
  });},
  async appeal({actorId,reviewId,expectedVersion,details}){return database.transaction(async client=>{
    const r=(await client.query('SELECT * FROM transaction_reviews WHERE id=$1 AND author_id=$2 FOR UPDATE',[reviewId,actorId])).rows[0];
    if(!r)throw fail('review_not_found',404,'Avaliação não encontrada.');
    const previous=(await client.query('SELECT a.*,st.protocol FROM review_visibility_appeals a JOIN support_tickets st ON st.id=a.ticket_id WHERE a.review_id=$1 AND a.version=$2',[reviewId,expectedVersion])).rows[0];
    if(previous){if(previous.details!==details)throw fail('review_appeal_conflict',409,'A contestação já foi registrada.');return {id:previous.id,protocol:previous.protocol,reused:true};}
    if(r.visibility==='public'||r.visibility_version!==expectedVersion)throw fail('review_visibility_conflict',409,'Consulte o estado atual da avaliação.');
    const support=await ticket(client,actorId,'Contestação de avaliação',details,'review-visibility-appeal:'+reviewId+':'+expectedVersion,r.transaction_id);
    const appeal=(await client.query('INSERT INTO review_visibility_appeals(review_id,version,author_id,ticket_id,details) VALUES($1,$2,$3,$4,$5) RETURNING id',[reviewId,expectedVersion,actorId,support.id])).rows[0];
    await audit(client,actorId,'review.visibility.appealed',reviewId,{version:expectedVersion});return {id:appeal.id,protocol:support.protocol,reused:false};
  });},
  async decide({actorId,reviewId,expectedVersion,outcome,reason,checkContent}){return database.transaction(async client=>{
    const r=(await client.query('SELECT * FROM transaction_reviews WHERE id=$1 FOR UPDATE',[reviewId])).rows[0];if(!r)throw fail('review_not_found',404,'Avaliação não encontrada.');
    const reporter=(await client.query('SELECT id FROM review_reports WHERE review_id=$1 AND reporter_id=$2',[reviewId,actorId])).rows[0];
    const former=(await client.query('SELECT reviewer_id FROM review_visibility_decisions WHERE review_id=$1 ORDER BY version DESC LIMIT 1',[reviewId])).rows[0];
    if([r.author_id,r.subject_id].includes(actorId)||reporter)throw fail('review_independent_moderator_required',403,'A análise exige moderador sem participação na avaliação ou denúncia.');
    if(r.visibility_version!==expectedVersion){
      const previous=(await client.query('SELECT reviewer_id,outcome,reason FROM review_visibility_decisions WHERE review_id=$1 AND version=$2',[reviewId,expectedVersion+1])).rows[0];
      if(r.visibility_version===expectedVersion+1&&previous?.reviewer_id===actorId&&previous.outcome===outcome&&previous.reason===reason)return {id:reviewId,visibility:r.visibility,version:r.visibility_version,reused:true};
      throw fail('review_visibility_conflict',409,'A avaliação foi atualizada; consulte novamente.');
    }
    const appeal=(await client.query('SELECT id FROM review_visibility_appeals WHERE review_id=$1 AND version=$2',[reviewId,expectedVersion])).rows[0];
    if(appeal&&former?.reviewer_id===actorId)throw fail('review_independent_appeal_required',403,'Outra pessoa deve analisar a contestação da decisão anterior.');
    if(r.visibility==='public')throw fail('review_not_hidden',409,'Não há ocultação para analisar.');
    if(outcome==='public')await checkContent(r);
    const version=r.visibility_version+1;
    await client.query('INSERT INTO review_visibility_decisions(review_id,reviewer_id,version,outcome,reason) VALUES($1,$2,$3,$4,$5)',[reviewId,actorId,version,outcome,reason]);
    await client.query('UPDATE transaction_reviews SET visibility=$2,visibility_version=$3 WHERE id=$1',[reviewId,outcome,version]);
    const linked=(await client.query(`SELECT ticket_id FROM review_reports WHERE review_id=$1 UNION SELECT ticket_id FROM review_visibility_appeals WHERE review_id=$1`,[reviewId])).rows;
    for(const t of linked){await client.query('INSERT INTO support_ticket_messages(ticket_id,author_id,body) VALUES($1,$2,$3)',[t.ticket_id,actorId,outcome==='public'?'A avaliação foi restaurada após análise registrada.':'A avaliação foi retirada da consulta pública após análise registrada.']);await client.query("UPDATE support_tickets SET status='resolved',updated_at=now() WHERE id=$1",[t.ticket_id]);}
    await audit(client,actorId,'review.visibility.decided',reviewId,{outcome,version});return {id:reviewId,visibility:outcome,version,reused:false};
  });}
});}
