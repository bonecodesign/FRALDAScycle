import assert from 'node:assert/strict';
import { createModerationRepository } from '../database/moderation-repository.js';
import { createModerationService } from '../apps/api/moderation-service.js';
import { createCommunicationsRepository } from '../database/communications-repository.js';
import { createCommunicationsService } from '../apps/api/communications-service.js';
import { createMarketplaceRepository } from '../database/marketplace-repository.js';
import { createMarketplaceService } from '../apps/api/marketplace-service.js';
import { createPremiumRepository } from '../database/premium-repository.js';

export async function seedBrowserCommunication(database,userId,sellerId) {
  const listing=(await database.query(`INSERT INTO listings(seller_id,title,description,brand,category,model,package_condition,quantity,kind,price_cents,status)
    VALUES($1,'Pacote fictício chat','Descrição de fixture interna','Pampers','infant','Confort Sec','sealed',10,'sale',10000,'unavailable') RETURNING id`,[sellerId])).rows[0].id;
  const transaction=(await database.query("INSERT INTO transactions(listing_id,buyer_id,seller_id,status,amount_cents) VALUES($1,$2,$3,'paid',10000) RETURNING id",[listing,userId,sellerId])).rows[0].id;
  await database.query(`INSERT INTO payment_intents(transaction_id,buyer_id,idempotency_key,method,amount_cents,platform_fee_cents,delivery_fee_cents,seller_amount_cents,provider_reference,status)
    VALUES($1,$2,$3,'pix',10000,800,0,9200,$4,'paid')`,[transaction,userId,'synthetic-chat-intent:'+transaction,'synthetic-chat-reference:'+transaction]);
  return transaction;
}
export async function validateSyntheticModeration(database,{user,other,transaction}) {
  const admin={id:'10000000-0000-4000-8000-000000000003',role:'admin'};
  const reviewer={id:'60000000-0000-4000-8000-000000000003',role:'moderator'};
  await database.query("INSERT INTO users(id,email,password_hash,display_name,role) VALUES($1,'synthetic-reviewer@example.test','synthetic-unusable-hash','Revisor fictício','moderator')",[reviewer.id]);
  const moderation=createModerationRepository(database),service=createModerationService(moderation);
  const communications=createCommunicationsService(createCommunicationsRepository(database),moderation);
  const marketplace=createMarketplaceService(createMarketplaceRepository(database),moderation,{async verifyListingMedia(){}});
  await assert.rejects(communications.messages(admin.id,transaction),e=>e.status===404);
  const sent=await Promise.all([communications.send(user,transaction,{body:'O pacote está pronto para coleta.',idempotencyKey:'synthetic-chat-ready'}),communications.send(user,transaction,{body:'O pacote está pronto para coleta.',idempotencyKey:'synthetic-chat-ready'})]);
  assert.equal(sent.filter(item=>!item.reused).length,1);
  assert.equal((await communications.messages(other,transaction)).length,1);
  await assert.rejects(communications.send(user,transaction,{body:'Outro texto para a mesma chave.',idempotencyKey:'synthetic-chat-ready'}),e=>e.code==='message_key_conflict');
  const blocked=await Promise.allSettled([communications.send(user,transaction,{body:'fake@example.test',idempotencyKey:'synthetic-chat-contact'}),communications.send(user,transaction,{body:'fake@example.test',idempotencyKey:'synthetic-chat-contact'})]);
  assert.equal(blocked.filter(item=>item.status==='rejected').length,2);
  assert.equal((await communications.messages(user,transaction)).length,1);
  const contact=(await service.list({id:user,role:'customer'})).find(item=>item.surface==='chat');
  assert.ok(contact);assert.equal((await service.list({id:other,role:'customer'})).length,0);
  await assert.rejects(service.detail({id:other,role:'customer'},contact.id),e=>e.status===404);
  const appeals=await Promise.all([service.appeal({id:user},contact.id,{body:'Solicito revisão da ocorrência fictícia.'}),service.appeal({id:user},contact.id,{body:'Solicito revisão da ocorrência fictícia.'})]);
  assert.equal(appeals.filter(item=>!item.reused).length,1);
  await assert.rejects(service.reviewAppeal({id:user,role:'admin'},contact.id,{confirmed:true,outcome:'upheld',reason:'Revisão fictícia por titular indevida.'}),e=>e.code==='moderation_independent_reviewer_required');
  const upheld=await Promise.all([service.reviewAppeal(admin,contact.id,{confirmed:true,outcome:'upheld',reason:'Contato identificado, a regra permanece aplicada.'}),service.reviewAppeal(admin,contact.id,{confirmed:true,outcome:'upheld',reason:'Contato identificado, a regra permanece aplicada.'})]);
  assert.equal(upheld.filter(item=>!item.reused).length,1);
  const barcode='Lote fictício 12345678 da embalagem.';
  await assert.rejects(communications.send(user,transaction,{body:barcode,idempotencyKey:'synthetic-barcode-key'}),e=>e.code==='content_requires_moderation');
  const barcodeDecision=(await service.list({id:user})).find(item=>item.surface==='chat'&&item.status==='blocked');
  await service.appeal({id:user},barcodeDecision.id,{body:'O número é um lote fictício, não um telefone.'});
  await assert.rejects(service.reviewAppeal(admin,barcodeDecision.id,{confirmed:true,outcome:'overturned',reason:'Revisão de falso positivo fictício.',reviewedText:'texto diferente'}),e=>e.code==='moderation_review_content_mismatch');
  await service.reviewAppeal(admin,barcodeDecision.id,{confirmed:true,outcome:'overturned',reason:'Revisão de falso positivo fictício.',reviewedText:barcode});
  await communications.send(user,transaction,{body:barcode,idempotencyKey:'synthetic-barcode-key'});
  assert.equal((await communications.messages(user,transaction)).length,2);
  await assert.rejects(communications.review(other,transaction,{rating:5,comment:'Produto conforme informado.'}),e=>e.code==='review_not_finalized');
  // Estado final é fixture: não executa conclusão financeira, liberação ou repasse.
  await database.query("UPDATE transactions SET status='completed' WHERE id=$1",[transaction]);
  const reviews=await Promise.all([communications.review(other,transaction,{rating:5,comment:'Produto conforme informado.'}),communications.review(other,transaction,{rating:5,comment:'Produto conforme informado.'})]);
  assert.equal(reviews.filter(item=>!item.reused).length,1);
  await assert.rejects(communications.review(user,transaction,{rating:4,comment:'fake@example.test'}),e=>e.code==='content_requires_moderation');
  const publicReviews=await communications.publicReviews(user);assert.equal(publicReviews.length,1);
  assert.deepEqual(Object.keys(publicReviews[0]).sort(),['comment','created_at','id','rating']);
  const payload={title:'Pacote fictício seguro',description:'Pacote lacrado para fixture interna.',kind:'sale',quantity:10,priceCents:10000,category:'infant',brand:'Pampers',model:'Confort Sec',packageCondition:'sealed',mediaKeys:[`listings/${user}/synthetic.webp`]};
  await assert.rejects(marketplace.create(user,{...payload,description:'Contato fake@example.test para a fixture.'}),e=>e.code==='content_requires_moderation');
  const queued=await marketplace.create(user,payload);assert.equal(queued.status,'review');
  await assert.rejects(marketplace.detail(queued.id),e=>e.status===404);
  const until=new Date(Date.now()+86400000).toISOString(),suspension={userId:user,reason:'Ocorrência fictícia para ensaio de suspensão temporária.',until,idempotencyKey:'synthetic-suspension-key'};
  const suspended=await Promise.all([service.suspend(admin,suspension),service.suspend(admin,suspension)]);assert.equal(suspended.filter(item=>!item.reused).length,1);
  await assert.rejects(marketplace.create(user,payload),e=>e.code==='new_operations_suspended');
  await assert.rejects(marketplace.startTransaction(user,(await database.query("SELECT id FROM listings WHERE seller_id=$1 AND status='published' LIMIT 1",['50000000-0000-4000-8000-000000000002'])).rows[0].id),e=>e.code==='new_operations_suspended');
  assert.equal((await createPremiumRepository(database).status(user)).billingAllowed,false);
  await communications.messages(user,transaction);
  const decision=suspended[0].decision.id;await service.appeal({id:user},decision,{body:'Solicito revisão da suspensão fictícia.'});
  await assert.rejects(service.reviewAppeal(admin,decision,{confirmed:true,outcome:'overturned',reason:'Revisão da própria decisão inicial.'}),e=>e.code==='moderation_independent_reviewer_required');
  await service.reviewAppeal(reviewer,decision,{confirmed:true,outcome:'overturned',reason:'Revisor independente encerra restrição fictícia.'});
  assert.equal((await marketplace.create(user,payload)).status,'review');
  const audit=JSON.stringify((await database.query("SELECT metadata FROM audit_events WHERE action LIKE 'moderation.%' OR action='chat.message.created' OR action='review.created'")).rows);
  assert.ok(!audit.includes('fake@example.test'));assert.ok(!audit.includes(barcode));
  assert.equal((await database.query("SELECT count(*)::integer AS n FROM moderation_appeals WHERE decision_id=$1",[decision])).rows[0].n,1);
  console.log('BETA_MODERATION: contatos bloqueados, chat/review privados, recurso/protocolo concorrente, revisão independente, falso positivo exato, suspensão sem bloquear acompanhamento, fotos em revisão; zero mensagens externas.');
}
