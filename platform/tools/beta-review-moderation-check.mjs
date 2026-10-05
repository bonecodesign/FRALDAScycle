import assert from 'node:assert/strict';
import {createReviewModerationRepository} from '../database/review-moderation-repository.js';
import {createReviewModerationService} from '../apps/api/review-moderation-service.js';
import {createModerationRepository} from '../database/moderation-repository.js';
import {createCommunicationsRepository} from '../database/communications-repository.js';
export async function validateSyntheticReviewModeration(database,{user,other,transaction}){
  const service=createReviewModerationService(createReviewModerationRepository(database),createModerationRepository(database));
  const admin={id:'10000000-0000-4000-8000-000000000003',role:'admin'},moderator={id:'60000000-0000-4000-8000-000000000003',role:'moderator'},courier={id:'10000000-0000-4000-8000-000000000004',role:'courier'};
  const owner={id:other,role:'customer'},reporter={id:user,role:'customer'},publicRepository=createCommunicationsRepository(database);
  const review=(await publicRepository.publicReviews(user))[0];
  const report={category:'fraud',details:'Suspeita fictícia para validar o encaminhamento.',confirmed:true};
  const reports=await Promise.all([service.report(reporter,review.id,report),service.report(reporter,review.id,report)]);assert.equal(reports.filter(x=>!x.reused).length,1);
  assert.equal((await publicRepository.publicReviews(user)).length,0);
  await assert.rejects(service.report(reporter,review.id,{...report,category:'offensive'}),e=>e.code==='review_report_conflict');
  const appeal={expectedVersion:1,details:'Solicito revisão da ocultação fictícia.',confirmed:true};
  await assert.rejects(service.appeal(reporter,review.id,appeal),e=>e.status===404);
  const appeals=await Promise.all([service.appeal(owner,review.id,appeal),service.appeal(owner,review.id,appeal)]);assert.equal(appeals.filter(x=>!x.reused).length,1);
  const restore={expectedVersion:1,outcome:'public',reason:'Análise fictícia não confirma o risco da denúncia.',confirmed:true};
  await assert.rejects(service.decide({id:user,role:'admin'},review.id,restore),e=>e.code==='review_independent_moderator_required');
  const restored=await Promise.all([service.decide(admin,review.id,restore),service.decide(admin,review.id,restore)]);assert.equal(restored.filter(x=>!x.reused).length,1);
  assert.equal((await publicRepository.publicReviews(user)).length,1);
  await service.report(reporter,review.id,report);assert.equal((await publicRepository.publicReviews(user)).length,1); // Semantic retry does not hide the reviewed content again.
  await service.report(courier,review.id,{...report,category:'offensive'});assert.equal((await publicRepository.publicReviews(user)).length,0);
  await service.decide(admin,review.id,{...restore,expectedVersion:3,outcome:'removed'});
  const privateReview=(await service.own(owner))[0];assert.equal(privateReview.visibility,'removed');assert.ok(privateReview.review_reason);
  await service.appeal(owner,review.id,{...appeal,expectedVersion:4});
  await assert.rejects(service.decide(admin,review.id,{...restore,expectedVersion:4}),e=>e.code==='review_independent_appeal_required');
  await service.decide(moderator,review.id,{...restore,expectedVersion:4});
  const sensitive=(await database.query(`INSERT INTO transaction_reviews(transaction_id,author_id,subject_id,rating,comment) VALUES($1,$2,$3,4,'fake@example.test') RETURNING id`,[transaction,user,other])).rows[0]; // Exclusively fake content to prove restoration cannot bypass the API guard.
  await service.report(courier,sensitive.id,{...report,category:'privacy'});
  await assert.rejects(service.decide(admin,sensitive.id,restore),e=>e.code==='content_requires_moderation');
  assert.equal((await publicRepository.publicReviews(other)).length,0);
  await service.decide(admin,sensitive.id,{...restore,outcome:'removed'});
  assert.equal((await database.query('SELECT count(*)::int AS n FROM transaction_reviews WHERE id=$1',[sensitive.id])).rows[0].n,1);
  const audit=JSON.stringify((await database.query("SELECT metadata FROM audit_events WHERE action LIKE 'review.%'")).rows);assert.equal(audit.includes(report.details),false);assert.equal(audit.includes('fake@example.test'),false);
  console.log('BETA_REVIEW_MODERATION: denúncia e recurso concorrentes, ocultação pública, restauração/remoção, versão, revisor independente e privacidade sem bypass em PostgreSQL; registros privados preservados e sem mensagens externas.');
}
