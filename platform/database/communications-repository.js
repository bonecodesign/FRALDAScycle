const fail=(code,status,message)=>Object.assign(new Error(message),{code,status});
async function access(client,userId,transactionId,{completed=false}={}) {
  const row=(await client.query(`SELECT t.id,t.status,t.buyer_id,t.seller_id,l.kind,
    EXISTS(SELECT 1 FROM payment_intents p WHERE p.transaction_id=t.id AND p.status IN ('authorized','paid')) AS payment_confirmed
    FROM transactions t JOIN listings l ON l.id=t.listing_id WHERE t.id=$1 AND $2 IN (t.buyer_id,t.seller_id) FOR UPDATE OF t`,[transactionId,userId])).rows[0];
  if(!row)throw fail('transaction_not_found',404,'Operação não encontrada.');
  if(completed ? row.status!=='completed' : row.kind==='donation'||!row.payment_confirmed||['cancelled','refunded'].includes(row.status)) {
    throw fail(completed?'review_not_finalized':'chat_not_allowed',409,completed?'Avaliação somente após finalizar a operação.':'Chat indisponível para esta operação.');
  }
  return row;
}
export function createCommunicationsRepository(database) {
  return Object.freeze({
    async canAccess(userId,transactionId,completed=false) { return database.transaction(client=>access(client,userId,transactionId,{completed})); },
    messages(userId,transactionId) { return database.transaction(async client=>{
      await access(client,userId,transactionId);
      return (await client.query('SELECT id,author_id,body,created_at FROM transaction_messages WHERE transaction_id=$1 ORDER BY created_at,id LIMIT 200',[transactionId])).rows;
    }); },
    send(userId,transactionId,{body,idempotencyKey}) { return database.transaction(async client=>{
      await access(client,userId,transactionId);
      const old=(await client.query('SELECT id,body,created_at FROM transaction_messages WHERE transaction_id=$1 AND author_id=$2 AND idempotency_key=$3',[transactionId,userId,idempotencyKey])).rows[0];
      if(old) {
        if(old.body!==body)throw fail('message_key_conflict',409,'Use uma nova chave para outra mensagem.');
        return {message:old,reused:true};
      }
      const message=(await client.query('INSERT INTO transaction_messages(transaction_id,author_id,body,idempotency_key) VALUES($1,$2,$3,$4) RETURNING id,body,created_at',[transactionId,userId,body,idempotencyKey])).rows[0];
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'chat.message.created','transaction',$2,'{}'::jsonb)`,[userId,transactionId]);
      return {message,reused:false};
    }); },
    review(userId,transactionId,{rating,comment}) { return database.transaction(async client=>{
      const tx=await access(client,userId,transactionId,{completed:true});
      const old=(await client.query('SELECT id,rating,comment,created_at FROM transaction_reviews WHERE transaction_id=$1 AND author_id=$2',[transactionId,userId])).rows[0];
      if(old) {
        if(old.rating!==rating||old.comment!==comment)throw fail('review_already_recorded',409,'Avaliação já registrada. Solicite correção pelo suporte.');
        return {review:old,reused:true};
      }
      const subject=tx.buyer_id===userId?tx.seller_id:tx.buyer_id;
      const review=(await client.query('INSERT INTO transaction_reviews(transaction_id,author_id,subject_id,rating,comment) VALUES($1,$2,$3,$4,$5) RETURNING id,rating,comment,created_at',[transactionId,userId,subject,rating,comment])).rows[0];
      await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'review.created','transaction',$2,'{}'::jsonb)`,[userId,transactionId]);
      return {review,reused:false};
    }); },
    async publicReviews(subjectId) { return (await database.query("SELECT id,rating,comment,created_at FROM transaction_reviews WHERE subject_id=$1 AND visibility='public' ORDER BY created_at DESC,id LIMIT 100",[subjectId])).rows; },
  });
}
