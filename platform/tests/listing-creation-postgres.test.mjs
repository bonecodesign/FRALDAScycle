import assert from 'node:assert/strict';
import test from 'node:test';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {createMarketplaceRepository} from '../database/marketplace-repository.js';
import {createMarketplaceService} from '../apps/api/marketplace-service.js';

const databaseUrl=process.env.FC_LISTING_TEST_DATABASE_URL;
test('PostgreSQL applies listing identity upgrade and deduplicates concurrent retries atomically',{
  skip:!databaseUrl?'Banco temporário de validação não configurado.':false,
  timeout:60000,
},async()=>{
  const url=new URL(databaseUrl);
  assert.equal(url.pathname,'/fc_listing_creation_test','Use somente a base temporária dedicada a este teste.');
  assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
  const database=createDatabase({databaseUrl,databaseSsl:false});
  try{
    const migrations=await discoverMigrations();
    const initial=migrations.filter(item=>item.name<'043_');
    await Promise.all([migrate(database,initial),migrate(database,initial)]);
    const owner='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
    await database.query(`INSERT INTO users(id,email,password_hash,display_name) VALUES
      ($1,'listing-one@example.test','synthetic-unusable','Pessoa fictícia um'),
      ($2,'listing-two@example.test','synthetic-unusable','Pessoa fictícia dois')`,[owner,other]);
    await database.query(`INSERT INTO listings(seller_id,title,description,brand,model,category,package_condition,quantity,kind,price_cents,status)
      VALUES($1,'Anúncio anterior','Descrição sintética anterior à migração','Pampers','Confort Sec','infant','sealed',10,'sale',1000,'review')`,[owner]);
    await Promise.all([migrate(database,migrations),migrate(database,migrations)]);
    await migrate(database,migrations);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count,migrations.length);
    assert.equal((await database.query('SELECT creation_key FROM listings')).rows[0].creation_key,null);
    console.log(`Migrações verificadas: ${migrations.length}; anúncio anterior preservado.`);
    const service=createMarketplaceService(createMarketplaceRepository(database),null,{async verifyListingMedia(){}});
    const key='20000000-0000-4000-8000-000000000001';
    const input={title:'Pacote Pampers Confort Sec',description:'Pacote fechado, lacrado e armazenado em local seco.',category:'infant',brand:'Pampers',model:'Confort Sec',size:'M',quantity:50,kind:'sale',priceCents:3500,packageCondition:'sealed',mediaKeys:[`listings/${owner}/photo.webp`],idempotencyKey:key};
    const results=await Promise.all(Array.from({length:20},()=>service.create(owner,input)));
    assert.equal(new Set(results.map(item=>item.id)).size,1);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM listings WHERE seller_id=$1 AND creation_key=$2',[owner,key])).rows[0].count,1);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM listing_media WHERE listing_id=$1',[results[0].id])).rows[0].count,1);
    await assert.rejects(service.create(owner,{...input,quantity:51}),error=>error.code==='listing_creation_conflict');
    const another=await service.create(other,{...input,mediaKeys:[`listings/${other}/photo.webp`]});
    assert.notEqual(another.id,results[0].id);
    await database.query("UPDATE listings SET status='published',published_at=now() WHERE id=$1",[results[0].id]);
    assert.equal((await service.create(owner,input)).status,'published');
    console.log('20 envios simultâneos: 1 anúncio e 1 foto; conflito e isolamento por conta verificados.');
    await database.query(`CREATE FUNCTION reject_test_media() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.storage_key LIKE '%rollback.webp' THEN RAISE EXCEPTION 'synthetic media failure'; END IF; RETURN NEW; END $$`);
    await database.query('CREATE TRIGGER reject_test_media BEFORE INSERT ON listing_media FOR EACH ROW EXECUTE FUNCTION reject_test_media()');
    const rollbackKey='20000000-0000-4000-8000-000000000002';
    const rollbackInput={...input,idempotencyKey:rollbackKey,mediaKeys:[`listings/${owner}/rollback.webp`]};
    await assert.rejects(service.create(owner,rollbackInput),/synthetic media failure/);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM listings WHERE creation_key=$1',[rollbackKey])).rows[0].count,0);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM listings WHERE seller_id=$1',[owner])).rows[0].count,2);
    await database.query('DROP TRIGGER reject_test_media ON listing_media');
    const recovered=await service.create(owner,rollbackInput);assert.ok(recovered.id);
    await assert.rejects(database.query('UPDATE listings SET creation_fingerprint=NULL WHERE id=$1',[recovered.id]),error=>error.code==='23514');
    console.log('Falha de mídia: rollback completo e repetição com a mesma chave verificados.');
  }finally{await database.close()}
});
