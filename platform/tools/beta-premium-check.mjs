import assert from 'node:assert/strict';
import { createPremiumRepository } from '../database/premium-repository.js';
import { createPremiumService } from '../apps/api/premium-service.js';
import { createMarketplaceRepository } from '../database/marketplace-repository.js';
import { createOperationSupportRepository } from '../database/operation-support-repository.js';

export async function seedBrowserPremium(database, userId) {
  await database.query(`INSERT INTO premium_subscriptions(user_id,paid_period_start,paid_period_end,renewal_enabled)
    VALUES($1,now()-interval '1 day',now()+interval '1 day',true)`, [userId]);
  for (let i=0; i<4; i++) await insertListing(database, userId, i);
}
async function insertListing(database, userId, offset, status='published') {
  return (await database.query(`INSERT INTO listings(seller_id,title,description,brand,category,model,package_condition,quantity,kind,price_cents,status,published_at)
    VALUES($1,$2,'Descrição exclusiva de fixture fictícia','Pampers','infant','Confort Sec','sealed',10,'sale',10000,$3::listing_status,now()-($4::integer*interval '1 hour')) RETURNING id`,
    [userId, 'Pacote fictício Premium ' + offset, status, offset])).rows[0].id;
}
export async function validateSyntheticPremium(database) {
  const owner='50000000-0000-4000-8000-000000000001', other='50000000-0000-4000-8000-000000000002';
  await database.query(`INSERT INTO users(id,email,password_hash,display_name) VALUES
    ($1,'premium-one@example.test','synthetic-unusable-hash','Conta Premium fictícia'),
    ($2,'premium-two@example.test','synthetic-unusable-hash','Outra conta fictícia')`,[owner,other]);
  await seedBrowserPremium(database, owner);
  const repository=createPremiumRepository(database), service=createPremiumService(repository);
  const active=await service.status(owner), ids=active.listings.map(listing=>listing.id);
  assert.equal(active.state,'active'); assert.equal(active.billingAllowed,false);
  assert.equal((await service.status(other)).state,'free');
  const ongoing=await insertListing(database,owner,9,'unavailable');
  const tx=(await database.query(`INSERT INTO transactions(listing_id,buyer_id,seller_id,status,amount_cents)
    VALUES($1,$2,$3,'initiated',10000) RETURNING id`,[ongoing,other,owner])).rows[0].id;
  const foreign=await insertListing(database,other,1);
  await assert.rejects(service.saveChoice(owner,{selectedIds:[foreign],expectedVersion:0}),e=>e.code==='premium_invalid_choice');
  await assert.rejects(service.saveChoice(owner,{selectedIds:[ongoing],expectedVersion:0}),e=>e.code==='premium_invalid_choice');
  const choices=await Promise.allSettled([
    service.saveChoice(owner,{selectedIds:[ids[1],ids[2],ids[3]],expectedVersion:0}),
    service.saveChoice(owner,{selectedIds:[ids[0]],expectedVersion:0}),
  ]);
  assert.equal(choices.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(choices.find(result=>result.status==='rejected').reason.code,'premium_choice_conflict');
  const chosen=(await service.status(owner)).choice.selectedIds;
  assert.equal((await service.saveChoice(owner,{selectedIds:[...chosen].reverse(),expectedVersion:0})).reused,true);
  const cancellations=await Promise.all([service.cancelRenewal(owner,{confirmed:true}),service.cancelRenewal(owner,{confirmed:true})]);
  assert.equal(cancellations.filter(result=>!result.reused).length,1);
  assert.equal((await service.status(owner)).state,'active');
  assert.equal((await database.query("SELECT count(*)::integer AS n FROM audit_events WHERE actor_user_id=$1 AND action='premium.renewal.cancelled'",[owner])).rows[0].n,1);
  // Falha original há dois dias: benefícios persistem, sem nova cobrança.
  await database.query("UPDATE premium_subscriptions SET paid_period_start=now()-interval '32 days',paid_period_end=now()-interval '2 days',renewal_failed_at=now()-interval '2 days',renewal_enabled=true WHERE user_id=$1",[owner]);
  assert.equal((await service.status(owner)).state,'grace');
  assert.deepEqual((await repository.regularize(owner)).pausedIds,[]);
  // Escolha pertence ao período atual; atualizar fixture de período não a reutiliza indevidamente.
  await service.saveChoice(owner,{selectedIds:chosen,expectedVersion:0});
  await database.query("UPDATE premium_subscriptions SET paid_period_end=now()-interval '4 days',renewal_failed_at=now()-interval '4 days' WHERE user_id=$1",[owner]);
  await database.query('UPDATE premium_listing_choices SET paid_period_end=(SELECT paid_period_end FROM premium_subscriptions WHERE user_id=$1) WHERE user_id=$1',[owner]);
  assert.equal((await service.status(owner)).state,'free');
  const adjustments=await Promise.all([repository.regularize(owner),repository.regularize(owner)]);
  assert.equal(adjustments.filter(result=>result.pausedIds.length).length,1);
  assert.equal((await database.query('SELECT count(*)::integer AS n FROM premium_listing_adjustments WHERE user_id=$1',[owner])).rows[0].n,1);
  const current=await service.status(owner);
  assert.deepEqual(current.listings.filter(listing=>listing.status==='published').map(listing=>listing.id).sort(),[...chosen].sort());
  assert.equal(current.listings.find(listing=>listing.id===ongoing).status,'unavailable');
  assert.equal((await database.query('SELECT status FROM transactions WHERE id=$1',[tx])).rows[0].status,'initiated');
  await assert.rejects(service.changeListingStatus(owner,{listingId:foreign,status:'paused',expectedStatus:'published'}),e=>e.status===404);
  assert.throws(()=>service.changeListingStatus(owner,{listingId:ongoing,status:'paused',expectedStatus:'unavailable'}),e=>e.code==='invalid_listing_status');
  await assert.rejects(service.changeListingStatus(owner,{listingId:ongoing,status:'paused',expectedStatus:'published'}),e=>e.code==='listing_operation_pending');
  // Completar as três vagas e disputar a última: uma única retomada pode ocupar a vaga.
  for(const listing of (await service.status(owner)).listings.filter(l=>l.status==='published')) await service.changeListingStatus(owner,{listingId:listing.id,status:'paused',expectedStatus:'published'});
  for(const id of ids.slice(0,2)) await service.changeListingStatus(owner,{listingId:id,status:'published',expectedStatus:'paused'});
  const resumes=await Promise.allSettled(ids.slice(2).map(id=>service.changeListingStatus(owner,{listingId:id,status:'published',expectedStatus:'paused'})));
  assert.equal(resumes.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(resumes.find(result=>result.status==='rejected').reason.code,'free_listing_limit');
  // Cancelar uma operação não republica um quarto anúncio: preserva-o pausado.
  await createOperationSupportRepository(database).cancelTransaction({actorId:other,transactionId:tx});
  assert.equal((await database.query('SELECT status FROM listings WHERE id=$1',[ongoing])).rows[0].status,'paused');
  // A escolha antiga foi consumida: não pausa posteriormente anúncios gratuitos retomados.
  await repository.regularize(owner);
  assert.equal((await service.status(owner)).listings.filter(l=>l.status==='published').length,3);
  const marketplace=createMarketplaceRepository(database);
  const payload={sellerId:other,title:'Pacote fictício publicado',description:'Descrição exclusiva para teste de quota concorrente.',category:'infant',brand:'Pampers',model:'Confort',packageCondition:'sealed',openPackageAttested:false,size:'M',quantity:10,kind:'sale',priceCents:10000,city:null,state:null,latitude:null,longitude:null,institutionId:null,mediaKeys:[]};
  await marketplace.create(payload); // Outra conta tinha um anúncio.
  const publications=await Promise.allSettled([marketplace.create(payload),marketplace.create(payload)]);
  assert.equal(publications.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(publications.find(result=>result.status==='rejected').reason.code,'free_listing_limit');
  const defaultOwner='50000000-0000-4000-8000-000000000003';
  await database.query("INSERT INTO users(id,email,password_hash,display_name) VALUES($1,'premium-default@example.test','synthetic-unusable-hash','Escolha padrão fictícia')",[defaultOwner]);
  const defaultIds=[]; for(let i=0;i<5;i++) defaultIds.push(await insertListing(database,defaultOwner,i));
  await repository.regularize(defaultOwner);
  assert.deepEqual((await service.status(defaultOwner)).listings.filter(l=>l.status==='published').map(l=>l.id).sort(),defaultIds.slice(0,3).sort());
  console.log('BETA_PREMIUM: cancelamento idempotente, escolha concorrente, graça, pausa, quota de publicação/retomada e cancelamento sem exceder limite; zero cobrança.');
}
