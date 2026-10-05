const fail=(code,status,message)=>Object.assign(new Error(message),{code,status});
const fields='id,label,postal_code,street,number,complement,district,city,state';
export function createAddressRepository(database) {
  return Object.freeze({
    async ownAddresses(userId) {
      return database.transaction(async client=>{
        const result=await client.query(`SELECT ${fields} FROM addresses WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,[userId]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'address.listed','address','list','{}'::jsonb)`,[userId]);
        return result.rows;
      });
    },
    async createAddress(userId,input) {
      return database.transaction(async client=>{
        const result=await client.query(`INSERT INTO addresses(user_id,label,postal_code,street,number,complement,district,city,state)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${fields}`,
          [userId,input.label,input.postalCode,input.street,input.number,input.complement,input.district,input.city,input.state]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'address.created','address',$2,'{}'::jsonb)`,[userId,result.rows[0].id]);
        return result.rows[0];
      });
    },
    async shareAddress({actorId,shipmentId,addressId}) {
      return database.transaction(async client=>{
        const found=await client.query(`SELECT s.id,s.transaction_id,s.buyer_id,s.seller_id,s.courier_id,s.mode,s.status,
          t.status AS transaction_status,l.kind,
          EXISTS(SELECT 1 FROM payment_intents pi WHERE pi.transaction_id=t.id AND pi.status='paid'
            AND pi.amount_cents=t.amount_cents AND pi.provider_reference IS NOT NULL) AS payment_confirmed,
          EXISTS(SELECT 1 FROM payment_cases pc JOIN payment_intents pi ON pi.id=pc.payment_intent_id
            WHERE pi.transaction_id=t.id AND pc.status<>'rejected') OR
          EXISTS(SELECT 1 FROM support_tickets st WHERE st.transaction_id=t.id AND st.status<>'resolved'
            AND st.category IN('cancellation','receipt_problem')) AS financial_issue
          FROM shipments s JOIN transactions t ON t.id=s.transaction_id JOIN listings l ON l.id=t.listing_id
          WHERE s.id=$1 AND $2 IN(s.buyer_id,s.seller_id) FOR UPDATE OF s,t`,[shipmentId,actorId]);
        const shipment=found.rows[0];
        if(!shipment)throw fail('shipment_not_found',404,'Entrega não encontrada.');
        if(shipment.kind!=='sale')throw fail('address_flow_not_configured',503,'Compartilhamento de troca ou doação ainda pendente.');
        if(shipment.payment_confirmed!==true||shipment.financial_issue!==false||!['paid','in_delivery'].includes(shipment.transaction_status)||!['awaiting_pickup','assigned'].includes(shipment.status)) {
          throw fail('address_share_not_allowed',409,'A entrega ainda não permite compartilhar o endereço, ou já passou da coleta.');
        }
        const recipientId=shipment.mode==='pickup'&&actorId===shipment.seller_id?shipment.buyer_id:
          shipment.mode!=='pickup'?shipment.courier_id:null;
        if(!recipientId)throw fail('address_recipient_pending',409,'Aguarde a definição de quem fará a entrega ou retirada.');
        const owned=await client.query(`SELECT ${fields} FROM addresses WHERE id=$1 AND user_id=$2`,[addressId,actorId]);
        if(!owned.rows[0])throw fail('address_not_found',404,'Endereço não encontrado.');
        const existing=await client.query(`SELECT a.id,COALESCE(v.address_id,a.address_id) AS address_id,a.shared_at FROM shipment_address_shares a LEFT JOIN LATERAL (SELECT address_id FROM shipment_address_revisions WHERE share_id=a.id ORDER BY revision DESC LIMIT 1) v ON true WHERE shipment_id=$1 AND owner_id=$2 AND recipient_id=$3`,[shipmentId,actorId,recipientId]);
        if(existing.rows[0]) {
          if(existing.rows[0].address_id!==addressId)throw fail('address_change_requires_support',409,'O endereço já compartilhado só pode ser alterado pelo suporte.');
          return {id:existing.rows[0].id,sharedAt:existing.rows[0].shared_at,reused:true};
        }
        const snapshot={...owned.rows[0]};delete snapshot.id;delete snapshot.label;
        const result=await client.query(`INSERT INTO shipment_address_shares(shipment_id,owner_id,recipient_id,address_id,address_snapshot,notice_version)
          VALUES($1,$2,$3,$4,$5::jsonb,'FC-ADDRESS-1') RETURNING id,shared_at`,[shipmentId,actorId,recipientId,addressId,JSON.stringify(snapshot)]);
        await client.query('UPDATE transactions SET address_shared_at=COALESCE(address_shared_at,$2),updated_at=now() WHERE id=$1',[shipment.transaction_id,result.rows[0].shared_at]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'shipment.address.shared','shipment',$2,$3::jsonb)`,[actorId,shipmentId,JSON.stringify({shareId:result.rows[0].id,recipientId,noticeVersion:'FC-ADDRESS-1'})]);
        return {id:result.rows[0].id,sharedAt:result.rows[0].shared_at,reused:false};
      });
    },
    async sharedAddresses({userId,shipmentId}) {
      return database.transaction(async client=>{
        const result=await client.query(`SELECT a.id,a.owner_id,COALESCE(v.address_snapshot,a.address_snapshot) AS address_snapshot,a.shared_at,COALESCE(v.revision,0) AS revision
          FROM shipment_address_shares a JOIN shipments s ON s.id=a.shipment_id
          JOIN transactions t ON t.id=s.transaction_id
          LEFT JOIN LATERAL (SELECT revision,address_snapshot FROM shipment_address_revisions WHERE share_id=a.id ORDER BY revision DESC LIMIT 1) v ON true
          WHERE s.id=$1 AND (a.owner_id=$2 OR
            (a.recipient_id=$2 AND t.status IN('paid','in_delivery') AND s.status IN('awaiting_pickup','assigned','picked_up','in_transit')
             AND ((s.mode='pickup' AND s.buyer_id=$2) OR (s.mode<>'pickup' AND s.courier_id=$2))))`,[shipmentId,userId]);
        if(!result.rows.length)throw fail('shared_address_not_found',404,'Nenhum endereço disponível para este acesso.');
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'shipment.address.read','shipment',$2,'{}'::jsonb)`,[userId,shipmentId]);
        return result.rows;
      });
    },
  });
}

