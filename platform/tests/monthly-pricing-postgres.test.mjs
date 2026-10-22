import assert from 'node:assert/strict';
import test from 'node:test';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {createMonthlyPricingRepository} from '../database/monthly-pricing-repository.js';

const databaseUrl=process.env.FC_LISTING_TEST_DATABASE_URL;
test('PostgreSQL enforces monthly price reconciliation, seller adjustment and 30-day expiry',{
  skip:!databaseUrl?'Banco temporário de validação não configurado.':false,timeout:60000,
},async()=>{
  const url=new URL(databaseUrl);
  assert.equal(url.pathname,'/fc_listing_creation_test');
  assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
  const database=createDatabase({databaseUrl,databaseSsl:false});
  const seller='30000000-0000-4000-8000-000000000001';
  const listing='30000000-0000-4000-8000-000000000002';
  try{
    await migrate(database,await discoverMigrations());
    await database.query(`INSERT INTO users(id,email,password_hash,display_name,email_verified_at)
      VALUES($1,'pricing-seller@example.test','synthetic-unusable','Pessoa fictícia PRM',now())
      ON CONFLICT(id) DO NOTHING`,[seller]);
    await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,size,quantity,kind,price_cents,status,city,state,published_at,expires_at,price_reference_key)
      VALUES($1,$2,'Fralda sintética PRM','Pacote sintético fechado para teste.','infant','Marca Teste','Linha Teste','sealed','M',40,'sale',9000,'published','Belo Horizonte','MG',now()-interval '5 days',now()+interval '25 days','brand-test|line-test|m|40')`,[listing,seller]);
    const repository=createMonthlyPricingRepository(database);
    const now=new Date();
    const validFrom=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString().slice(0,10);
    const validUntil=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)).toISOString().slice(0,10);
    await repository.saveReference({referenceKey:'brand-test|line-test|m|40',validFrom,validUntil,prmCents:10000,lowestRetailCents:9500,collectedAt:new Date().toISOString(),metadata:{synthetic:true}});
    const before=(await database.query('SELECT published_at,expires_at FROM listings WHERE id=$1',[listing])).rows[0];
    const reconciled=await repository.reconcileReference({referenceKey:'brand-test|line-test|m|40',validFrom});
    assert.equal(reconciled.paused,1);
    let row=(await database.query('SELECT status,pause_reason,price_cents,published_at,expires_at FROM listings WHERE id=$1',[listing])).rows[0];
    assert.equal(row.status,'paused');assert.equal(row.pause_reason,'price_adjustment_required');assert.equal(row.price_cents,9000);
    assert.equal(new Date(row.published_at).toISOString(),new Date(before.published_at).toISOString());
    assert.equal(new Date(row.expires_at).toISOString(),new Date(before.expires_at).toISOString());
    await assert.rejects(repository.adjustPausedListingPrice({sellerId:seller,listingId:listing,priceCents:9600}),e=>e.code==='listing_price_above_ceiling');
    const adjusted=await repository.adjustPausedListingPrice({sellerId:seller,listingId:listing,priceCents:9000});
    assert.equal(adjusted.listing.status,'published');
    assert.equal(new Date(adjusted.listing.published_at).toISOString(),new Date(before.published_at).toISOString());
    assert.equal(new Date(adjusted.listing.expires_at).toISOString(),new Date(before.expires_at).toISOString());
    assert.equal((await database.query('SELECT count(*)::int AS count FROM listing_price_history WHERE listing_id=$1',[listing])).rows[0].count,2);
    assert.ok((await database.query(`SELECT count(*)::int AS count FROM audit_events WHERE entity_id=$1 AND action IN('listing.price_adjustment_required','listing.price_adjusted')`,[listing])).rows[0].count>=2);
    await database.query(`UPDATE listings SET expires_at=now()-interval '1 second',published_at=now()-interval '31 days' WHERE id=$1`,[listing]);
    const expired=await repository.expireListings();
    assert.ok(expired.listingIds.includes(listing));
    row=(await database.query('SELECT status,pause_reason FROM listings WHERE id=$1',[listing])).rows[0];
    assert.equal(row.status,'removed');assert.equal(row.pause_reason,null);
    await assert.rejects(repository.republishExpiredListing({sellerId:seller,listingId:listing,priceCents:9600}),e=>e.code==='listing_price_above_ceiling');
    const republished=await repository.republishExpiredListing({sellerId:seller,listingId:listing,priceCents:9000});
    assert.equal(republished.listing.status,'published');
    const republishedAt=new Date(republished.listing.published_at);const republishedExpiry=new Date(republished.listing.expires_at);
    assert.ok(republishedExpiry.getTime()-republishedAt.getTime()>=30*24*60*60*1000-5000);
    assert.ok(republishedExpiry.getTime()-republishedAt.getTime()<=30*24*60*60*1000+5000);
    assert.equal((await database.query(`SELECT count(*)::int AS count FROM listing_price_history WHERE listing_id=$1 AND reason='seller_republication'`,[listing])).rows[0].count,1);
    assert.equal((await database.query(`SELECT count(*)::int AS count FROM audit_events WHERE entity_id=$1 AND action='listing.republished'`,[listing])).rows[0].count,1);
  }finally{
    await database.query('DELETE FROM notification_outbox WHERE recipient_user_id=$1',[seller]).catch(()=>{});
    await database.query('DELETE FROM listings WHERE id=$1',[listing]).catch(()=>{});
    await database.query('DELETE FROM users WHERE id=$1',[seller]).catch(()=>{});
    await database.close();
  }
});
