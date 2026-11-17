import assert from 'node:assert/strict';
import test from 'node:test';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {createMarketplaceRepository} from '../database/marketplace-repository.js';
import {createMarketplaceService} from '../apps/api/marketplace-service.js';
import {createAdminService} from '../apps/api/admin-service.js';
import {createAdminRepository} from '../database/admin-repository.js';

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
    await database.query("UPDATE listings SET status='published',published_at=now(),expires_at=now()+interval '30 days' WHERE id=$1",[results[0].id]);
    assert.equal((await service.create(owner,input)).status,'published');
    const swim=await service.create(owner,{...input,title:'Fralda Splashers para piscina',description:'Pacote descartável para piscina, fechado e protegido.',category:'swim',model:'Splashers',size:'RN+',quantity:12,idempotencyKey:'20000000-0000-4000-8000-000000000003',mediaKeys:[`listings/${owner}/swim.webp`]});
    await database.query("UPDATE listings SET status='published',published_at=now(),expires_at=now()+interval '30 days' WHERE id=$1",[swim.id]);
    assert.deepEqual((await service.search({category:'swim',size:'RN+'})).map(item=>item.id),[swim.id]);
    assert.deepEqual(await service.search({category:'infant',size:'RN+'}),[]);
    console.log('20 envios simultâneos: 1 anúncio e 1 foto; filtro PostgreSQL de categoria e tamanho verificado.');
    await database.query(`CREATE FUNCTION reject_test_media() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.storage_key LIKE '%rollback.webp' THEN RAISE EXCEPTION 'synthetic media failure'; END IF; RETURN NEW; END $$`);
    await database.query('CREATE TRIGGER reject_test_media BEFORE INSERT ON listing_media FOR EACH ROW EXECUTE FUNCTION reject_test_media()');
    const rollbackKey='20000000-0000-4000-8000-000000000002';
    const rollbackInput={...input,idempotencyKey:rollbackKey,mediaKeys:[`listings/${owner}/rollback.webp`]};
    await assert.rejects(service.create(owner,rollbackInput),/synthetic media failure/);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM listings WHERE creation_key=$1',[rollbackKey])).rows[0].count,0);
    assert.equal((await database.query("SELECT count(*)::int AS count FROM listings WHERE seller_id=$1 AND category='infant'",[owner])).rows[0].count,2);
    await database.query('DROP TRIGGER reject_test_media ON listing_media');
    const recovered=await service.create(owner,rollbackInput);assert.ok(recovered.id);
    await assert.rejects(database.query('UPDATE listings SET creation_fingerprint=NULL WHERE id=$1',[recovered.id]),error=>error.code==='23514');
    console.log('Falha de mídia: rollback completo e repetição com a mesma chave verificados.');

    // FC-308: join the REAL local services across a single synthetic lifecycle.
    // No media provider, payment provider or human moderator is invoked.
    const reviewer='10000000-0000-4000-8000-000000000004';
    await database.query(`INSERT INTO users(id,email,password_hash,display_name,role,staff_access_level,staff_sector)
      VALUES($1,'listing-reviewer@example.test','synthetic-unusable','Moderador fictício','admin',5,'founder')`,[reviewer]);
    const actor={id:reviewer,sessionId:'synthetic-local-review-only'};
    let mediaReady=false,mediaChecks=0;
    const syntheticMedia={
      async verifyListingMedia(sellerId,keys){
        mediaChecks++;
        assert.equal(sellerId,owner);
        assert.deepEqual(keys,rollbackInput.mediaKeys);
        if(!mediaReady)throw Object.assign(new Error('Imagem sintética indisponível'),{code:'media_not_ready',status:409});
        return {verified:true,count:keys.length};
      },
    };
    const administration=createAdminService(createAdminRepository(database),syntheticMedia,{
      reviewSecret:'synthetic-local-review-secret-not-for-production'.repeat(2),
    });
    const detail=await administration.listingReviewDetail(actor,recovered.id);
    assert.equal(detail.listing.status,'review');
    assert.deepEqual(detail.media.map(item=>item.storage_key),rollbackInput.mediaKeys);
    assert.equal((await service.search({query:'Pampers',kind:'sale'})).some(item=>item.id===recovered.id),false);
    await assert.rejects(service.detail(recovered.id),error=>error.code==='listing_not_found');
    const reviewContext=administration.issueReviewContext(actor,detail,[{
      expiresAt:new Date(Date.now()+120_000).toISOString(),
    }]);
    assert.ok(reviewContext);
    const reviewInput={outcome:'published',reason:'Pacote fictício conferido com mídia simulada.',confirmed:true,reviewContext};
    await assert.rejects(
      administration.reviewListing({id:owner,sessionId:'seller'},recovered.id,reviewInput),
      error=>error.code==='independent_listing_review_required',
    );
    await assert.rejects(administration.reviewListing(actor,recovered.id,reviewInput),
      error=>error.code==='media_not_ready');
    assert.equal((await database.query('SELECT status FROM listings WHERE id=$1',[recovered.id])).rows[0].status,'review');
    assert.equal((await database.query('SELECT count(*)::integer AS count FROM listing_review_decisions WHERE listing_id=$1',[recovered.id])).rows[0].count,0);
    mediaReady=true;
    const approved=await administration.reviewListing(actor,recovered.id,reviewInput);
    assert.equal(approved.status,'published');
    assert.ok(new Date(approved.expires_at).getTime()>new Date(approved.published_at).getTime()+29*86400_000);
    assert.equal((await database.query('SELECT count(*)::integer AS count FROM listing_review_decisions WHERE listing_id=$1 AND reviewer_id=$2',[recovered.id,reviewer])).rows[0].count,1);
    assert.equal((await database.query("SELECT count(*)::integer AS count FROM audit_events WHERE entity_id=$1 AND action='listing.review.approved'",[recovered.id])).rows[0].count,1);
    const visible=await service.search({query:'Pampers',kind:'sale',category:'infant',size:'M'});
    assert.ok(visible.some(item=>item.id===recovered.id),'Only independently approved listings appear in search');
    const publicListing=await service.detail(recovered.id);
    assert.equal(publicListing.price_cents,3500);
    assert.equal(publicListing.status,'published');
    await assert.rejects(administration.reviewListing(actor,recovered.id,reviewInput),
      error=>error.code==='listing_review_conflict');
    assert.equal(mediaChecks,2,'Media check occurred once for the refused attempt and once for approval');
    const transaction=await service.startTransaction(other,recovered.id,{itemUnits:1});
    assert.equal(transaction.status,'initiated');
    assert.equal(transaction.amount_cents,3500);
    assert.equal(transaction.item_units,1);
    assert.equal((await service.chatAccess(other,transaction.id)).allowed,false);
    assert.equal((await service.chatAccess(other,transaction.id)).reason,'payment_not_confirmed');
    assert.equal((await service.chatAccess(owner,transaction.id)).allowed,false);
    await assert.rejects(service.chatAccess(reviewer,transaction.id),error=>error.code==='transaction_not_found');
    assert.equal((await database.query('SELECT count(*)::integer AS count FROM payment_intents WHERE transaction_id=$1',[transaction.id])).rows[0].count,0);
    assert.equal((await service.search({query:'Pampers',kind:'sale'})).some(item=>item.id===recovered.id),false,'Reserved single-unit listing is no longer searchable');
    await assert.rejects(service.startTransaction(other,recovered.id),error=>error.code==='listing_unavailable');
    assert.equal((await database.query('SELECT count(*)::integer AS count FROM transactions WHERE listing_id=$1',[recovered.id])).rows[0].count,1);
    console.log('FC-308: create -> independent review -> verified synthetic media -> catalog -> search -> transaction -> unpaid chat denied; no provider or human approval claimed.');

  }finally{await database.close()}
});
