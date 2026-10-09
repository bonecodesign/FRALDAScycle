import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {createDatabase} from '../database/client.js';
import {discoverMigrations, migrate} from '../database/migrate.js';
import {createMarketplaceRepository} from '../database/marketplace-repository.js';
import {createMarketplaceService} from '../apps/api/marketplace-service.js';
import {createCommunicationsRepository} from '../database/communications-repository.js';

const databaseUrl=process.env.FC_LISTING_TEST_DATABASE_URL;
test('PostgreSQL gates chat reads and writes on confirmed matching payment for participants', {
  skip:!databaseUrl?'Banco temporário de validação não configurado.':false, timeout:60000,
}, async()=>{
  const url=new URL(databaseUrl);
  assert.equal(url.pathname,'/fc_listing_creation_test');
  assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
  const database=createDatabase({databaseUrl,databaseSsl:false});
  try {
    await migrate(database,await discoverMigrations());
    const seller=randomUUID(),buyer=randomUUID(),outsider=randomUUID();
    for(const id of [seller,buyer,outsider]) {
      await database.query('INSERT INTO users(id,email,password_hash,display_name) VALUES($1,$2,$3,$4)',
        [id,`chat-${id}@example.test`,'synthetic-unusable','Pessoa fictícia']);
    }
    const listing=(await database.query(`INSERT INTO listings(seller_id,title,description,quantity,kind,price_cents,category,model,package_condition)
      VALUES($1,'Pacote fictício','Teste de pagamento confirmado',10,'sale',1000,'infant','Confort Sec','sealed') RETURNING id`,[seller])).rows[0].id;
    const transaction=(await database.query(`INSERT INTO transactions(listing_id,buyer_id,seller_id,amount_cents,status)
      VALUES($1,$2,$3,1000,'payment_pending') RETURNING id`,[listing,buyer,seller])).rows[0].id;
    const marketplace=createMarketplaceService(createMarketplaceRepository(database));
    const communications=createCommunicationsRepository(database);
    const send=actor=>communications.send(actor,transaction,{body:'Mensagem fictícia',idempotencyKey:randomUUID()});
    async function blocked() {
      for(const actor of [buyer,seller]) {
        assert.equal((await marketplace.chatAccess(actor,transaction)).allowed,false);
        await assert.rejects(communications.messages(actor,transaction),error=>error.code==='chat_not_allowed');
        await assert.rejects(send(actor),error=>error.code==='chat_not_allowed');
      }
    }
    await blocked();
    const payment=(await database.query(`INSERT INTO payment_intents(transaction_id,buyer_id,idempotency_key,method,
      amount_cents,platform_fee_cents,delivery_fee_cents,seller_amount_cents,provider_reference,status)
      VALUES($1,$2,$3,'pix',1000,0,0,1000,$4,'pending') RETURNING id`,
      [transaction,buyer,randomUUID(),`synthetic-${randomUUID()}`])).rows[0].id;
    for(const status of ['provider_pending','pending','authorized','failed','cancelled','refunded','disputed']) {
      await database.query('UPDATE payment_intents SET status=$2 WHERE id=$1',[payment,status]);
      await blocked();
    }
    await database.query("UPDATE payment_intents SET status='paid',provider_reference=NULL WHERE id=$1",[payment]);
    await blocked();
    await database.query('UPDATE payment_intents SET provider_reference=$2,amount_cents=900,seller_amount_cents=900 WHERE id=$1',
      [payment,`synthetic-${randomUUID()}`]);
    await blocked();
    await database.query('UPDATE payment_intents SET amount_cents=1000,seller_amount_cents=1000 WHERE id=$1',[payment]);
    await database.query("UPDATE transactions SET status='paid' WHERE id=$1",[transaction]);
    for(const actor of [buyer,seller]) {
      assert.equal((await marketplace.chatAccess(actor,transaction)).allowed,true);
      assert.ok((await send(actor)).message.id);
    }
    assert.equal((await communications.messages(buyer,transaction)).length,2);
    for(const operation of [()=>marketplace.chatAccess(outsider,transaction),
      ()=>communications.messages(outsider,transaction),()=>send(outsider)]) {
      await assert.rejects(operation(),error=>error.code==='transaction_not_found');
    }
    for(const status of ['cancelled','refunded']) {
      await database.query('UPDATE transactions SET status=$2 WHERE id=$1',[transaction,status]);
      await blocked();
    }
    await database.query("UPDATE transactions SET status='paid' WHERE id=$1",[transaction]);
    const institution=(await database.query(`INSERT INTO institutions(submitted_by_user_id,legal_name,public_name,tax_id,
      representative_name,representative_email,city,state,address_line,postal_code)
      VALUES($1,'Instituição fictícia','Instituição de teste','12345678901234','Representante fictício',
      'chat-institution@example.test','Cidade fictícia','SP','Endereço fictício','12345678') RETURNING id`,[seller])).rows[0].id;
    await database.query("UPDATE listings SET kind='donation',price_cents=NULL,institution_id=$2 WHERE id=$1",[listing,institution]);
    await blocked();
    assert.equal((await database.query('SELECT count(*)::int AS count FROM transaction_messages WHERE transaction_id=$1',
      [transaction])).rows[0].count,2,'Tentativas bloqueadas não persistem mensagens.');
  } finally { await database.close(); }
});
