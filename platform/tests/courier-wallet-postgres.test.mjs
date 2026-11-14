import assert from 'node:assert/strict';import test from 'node:test';
import {createDatabase} from '../database/client.js';import {discoverMigrations,migrate} from '../database/migrate.js';
import {createCourierWalletRepository} from '../database/courier-wallet-repository.js';import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';
const native=await nativePostgresTools();
const ids={courier:'11111111-1111-4111-8111-111111111111',l3:'33333333-3333-4333-8333-333333333333',l4:'44444444-4444-4444-8444-444444444444',l5:'55555555-5555-4555-8555-555555555555',payout:'66666666-6666-4666-8666-666666666666'};

test('courier wallet reserves one weekly PIX withdrawal and follows 3 to 4 to 5 with PostgreSQL',{skip:!native&&!process.env.CI?'PostgreSQL local indisponível.':false,timeout:90_000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{const db=createDatabase({databaseUrl,databaseSsl:false});try{
  await migrate(db,await discoverMigrations());
  assert.deepEqual((await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='courier_wallet_blocked_resolutions' AND column_name LIKE 'level4_%' ORDER BY column_name")).rows.map(row=>row.column_name),['level4_action','level4_at','level4_by','level4_note']);
  await db.query(`INSERT INTO users(id,email,password_hash,display_name,role,staff_access_level,staff_sector) VALUES
   ($1,'wallet-courier@example.test','fixture','Entregador','courier',NULL,NULL),
   ($2,'wallet-l3@example.test','fixture','Financeiro','admin',3,'finance'),
   ($3,'wallet-l4@example.test','fixture','Administrador','admin',4,'finance'),
   ($4,'wallet-l5@example.test','fixture','Fundador','admin',5,'founder')`,[ids.courier,ids.l3,ids.l4,ids.l5]);
  await db.query(`INSERT INTO courier_profiles(user_id,account_status,payout_status,payout_provider_reference)
   VALUES($1,'suspended','verified','provider-destination-synthetic')`,[ids.courier]);
  const repository=createCourierWalletRepository(db),hash='a'.repeat(64),evidence='b'.repeat(64);
  const credited=await repository.creditConfirmedPayout({courierId:ids.courier,payoutId:ids.payout,amountCents:5000,providerReferenceHash:hash,evidenceSha256:evidence,idempotencyKey:'wallet-credit-synthetic-0001'});
  assert.equal(credited.reused,false);assert.equal((await repository.summary(ids.courier)).available_cents,5000);
  const duplicate=await repository.creditConfirmedPayout({courierId:ids.courier,payoutId:ids.payout,amountCents:5000,providerReferenceHash:hash,evidenceSha256:evidence,idempotencyKey:'wallet-credit-synthetic-0001'});assert.equal(duplicate.reused,true);
  const requested=await repository.requestWithdrawal({courierId:ids.courier,amountCents:2000,idempotencyKey:'wallet-withdraw-synthetic-0001',now:new Date('2030-01-01T12:00:00Z')});
  assert.equal(requested.withdrawal.status,'requested');const summary=await repository.summary(ids.courier);assert.deepEqual({available:summary.available_cents,reserved:summary.reserved_cents,version:summary.version},{available:3000,reserved:2000,version:3});
  await assert.rejects(repository.requestWithdrawal({courierId:ids.courier,amountCents:2000,idempotencyKey:'wallet-withdraw-synthetic-0002',now:new Date('2030-01-08T11:59:59Z')}),error=>error.code==='withdrawal_weekly_limit');
  await assert.rejects(repository.advanceWithdrawal({withdrawalId:requested.withdrawal.id,actorId:ids.l4,accessLevel:3,note:'Tentativa com nível declarado diferente do cadastro.'}),error=>error.code==='withdrawal_stage_forbidden');
  await assert.rejects(repository.advanceWithdrawal({withdrawalId:requested.withdrawal.id,actorId:ids.l4,accessLevel:4,note:'Tentativa fora da ordem aprovada.'}),error=>error.code==='withdrawal_stage_forbidden');
  assert.equal((await repository.advanceWithdrawal({withdrawalId:requested.withdrawal.id,actorId:ids.l3,accessLevel:3,note:'Análise financeira sintética concluída.'})).status,'level3_proposed');
  await db.query("UPDATE users SET staff_access_level=4,staff_sector='operations' WHERE id=$1",[ids.l3]);
  await assert.rejects(repository.advanceWithdrawal({withdrawalId:requested.withdrawal.id,actorId:ids.l3,accessLevel:4,note:'Tentativa sem independência entre as etapas.'}),error=>error.code==='withdrawal_independent_reviewer_required');
  await db.query("UPDATE users SET staff_access_level=3,staff_sector='finance' WHERE id=$1",[ids.l3]);
  assert.equal((await repository.advanceWithdrawal({withdrawalId:requested.withdrawal.id,actorId:ids.l4,accessLevel:4,note:'Aprovação administrativa sintética concluída.'})).status,'level4_approved');
  assert.equal((await repository.advanceWithdrawal({withdrawalId:requested.withdrawal.id,actorId:ids.l5,accessLevel:5,note:'Autorização final sintética concluída.'})).status,'level5_authorized');
  const stored=(await db.query('SELECT payout_destination_reference,provider_reference_hash,status FROM courier_wallet_withdrawals WHERE id=$1',[requested.withdrawal.id])).rows[0];assert.deepEqual(stored,{payout_destination_reference:'provider-destination-synthetic',provider_reference_hash:null,status:'level5_authorized'});
  let commands=await repository.claimProviderCommands();assert.equal(commands.length,1);assert.equal(commands[0].attempts,1);
  assert.equal((await repository.rescheduleProviderCommand({commandId:commands[0].id,claimToken:commands[0].claim_token,failureCode:'provider_unavailable',retryAfterSeconds:30})).status,'failed');
  await db.query('UPDATE courier_wallet_provider_commands SET available_at=now()-interval \'1 second\' WHERE id=$1',[commands[0].id]);
  commands=await repository.claimProviderCommands();assert.equal(commands.length,1);assert.equal(commands[0].attempts,2);
  const providerHash='c'.repeat(64);assert.equal((await repository.markProviderPending({commandId:commands[0].id,claimToken:commands[0].claim_token,providerReferenceHash:providerHash})).status,'provider_pending');
  const completed=await repository.reconcileProviderEvent({providerReferenceHash:providerHash,status:'completed',evidenceSha256:'d'.repeat(64),idempotencyKey:'wallet-release-synthetic-0001'});
  assert.equal(completed.withdrawal.status,'completed');assert.equal(completed.reused,false);
  assert.equal((await repository.reconcileProviderEvent({providerReferenceHash:providerHash,status:'completed',evidenceSha256:'d'.repeat(64),idempotencyKey:'wallet-release-synthetic-0001'})).reused,true);
  let balance=await repository.summary(ids.courier);assert.deepEqual({available:balance.available_cents,reserved:balance.reserved_cents,version:balance.version},{available:3000,reserved:0,version:4});
  const second=await repository.requestWithdrawal({courierId:ids.courier,amountCents:2000,idempotencyKey:'wallet-withdraw-synthetic-0003',now:new Date('2030-01-09T12:00:00Z')});
  await repository.advanceWithdrawal({withdrawalId:second.withdrawal.id,actorId:ids.l3,accessLevel:3,note:'Segunda análise financeira sintética.'});
  await repository.advanceWithdrawal({withdrawalId:second.withdrawal.id,actorId:ids.l4,accessLevel:4,note:'Segunda aprovação administrativa sintética.'});
  await repository.advanceWithdrawal({withdrawalId:second.withdrawal.id,actorId:ids.l5,accessLevel:5,note:'Segunda autorização final sintética.'});
  commands=await repository.claimProviderCommands();const secondProviderHash='e'.repeat(64);await repository.markProviderPending({commandId:commands[0].id,claimToken:commands[0].claim_token,providerReferenceHash:secondProviderHash});
  const returned=await repository.reconcileProviderEvent({providerReferenceHash:secondProviderHash,status:'failed',failureCode:'destination_rejected',evidenceSha256:'f'.repeat(64),idempotencyKey:'wallet-return-synthetic-0001'});
  assert.equal(returned.withdrawal.status,'returned');balance=await repository.summary(ids.courier);assert.deepEqual({available:balance.available_cents,reserved:balance.reserved_cents},{available:3000,reserved:0});
  const third=await repository.requestWithdrawal({courierId:ids.courier,amountCents:2000,idempotencyKey:'wallet-withdraw-synthetic-0004',now:new Date('2030-01-17T12:00:00Z')});
  await repository.advanceWithdrawal({withdrawalId:third.withdrawal.id,actorId:ids.l3,accessLevel:3,note:'Terceira análise financeira sintética.'});
  await repository.advanceWithdrawal({withdrawalId:third.withdrawal.id,actorId:ids.l4,accessLevel:4,note:'Terceira aprovação administrativa sintética.'});
  await repository.advanceWithdrawal({withdrawalId:third.withdrawal.id,actorId:ids.l5,accessLevel:5,note:'Terceira autorização final sintética.'});
  commands=await repository.claimProviderCommands();assert.equal(commands.length,1);
  const blocked=await repository.blockProviderCommand({commandId:commands[0].id,claimToken:commands[0].claim_token,failureCode:'retry_exhausted'});
  assert.equal(blocked.status,'blocked');balance=await repository.summary(ids.courier);assert.deepEqual({available:balance.available_cents,reserved:balance.reserved_cents},{available:1000,reserved:2000});
  const queue=await repository.blockedProviderCommands();assert.equal(queue.length,1);assert.equal(queue[0].withdrawal_id,third.withdrawal.id);assert.equal(Object.hasOwn(queue[0],'payout_destination_reference'),false);
  const proposal=await repository.proposeBlockedResolution({commandId:blocked.id,actorId:ids.l3,action:'retry',note:'Reenviar após conferência financeira completa.'});assert.equal(proposal.status,'proposed');assert.equal(proposal.proposed_action,'retry');
  await assert.rejects(repository.proposeBlockedResolution({commandId:blocked.id,actorId:ids.l3,action:'return_to_wallet',note:'Segunda proposta concorrente deve ser recusada.'}),error=>error.code==='blocked_resolution_already_open');
  const review=await repository.reviewBlockedResolution({resolutionId:proposal.id,actorId:ids.l4,action:'return_to_wallet',note:'Modificar para devolução após revisão administrativa.'});assert.equal(review.status,'level4_approved');assert.equal(review.level4_action,'return_to_wallet');
  await assert.rejects(repository.reviewBlockedResolution({resolutionId:proposal.id,actorId:ids.l4,action:'retry',note:'Revisão duplicada deve ser recusada.'}),error=>error.code==='blocked_resolution_not_reviewable');
  const authorization=await repository.authorizeBlockedResolution({resolutionId:proposal.id,actorId:ids.l5,note:'Autorização final da devolução após três análises.'});assert.equal(authorization.status,'level5_authorized');
  await assert.rejects(repository.authorizeBlockedResolution({resolutionId:proposal.id,actorId:ids.l5,note:'Autorização duplicada deve ser recusada.'}),error=>error.code==='blocked_resolution_not_authorizable');
  balance=await repository.summary(ids.courier);assert.deepEqual({available:balance.available_cents,reserved:balance.reserved_cents},{available:1000,reserved:2000});
  const executedReturn=await repository.executeAuthorizedResolution({resolutionId:proposal.id});assert.equal(executedReturn.result,'wallet_returned');assert.equal(executedReturn.reused,false);
  assert.equal((await repository.executeAuthorizedResolution({resolutionId:proposal.id})).reused,true);balance=await repository.summary(ids.courier);assert.deepEqual({available:balance.available_cents,reserved:balance.reserved_cents},{available:3000,reserved:0});
  const fourth=await repository.requestWithdrawal({courierId:ids.courier,amountCents:2000,idempotencyKey:'wallet-withdraw-synthetic-0005',now:new Date('2030-01-25T12:00:00Z')});
  await repository.advanceWithdrawal({withdrawalId:fourth.withdrawal.id,actorId:ids.l3,accessLevel:3,note:'Quarta análise financeira sintética.'});await repository.advanceWithdrawal({withdrawalId:fourth.withdrawal.id,actorId:ids.l4,accessLevel:4,note:'Quarta aprovação administrativa sintética.'});await repository.advanceWithdrawal({withdrawalId:fourth.withdrawal.id,actorId:ids.l5,accessLevel:5,note:'Quarta autorização final sintética.'});
  commands=await repository.claimProviderCommands();const fourthBlocked=await repository.blockProviderCommand({commandId:commands[0].id,claimToken:commands[0].claim_token,failureCode:'provider_retry_exhausted'});
  const retryProposal=await repository.proposeBlockedResolution({commandId:fourthBlocked.id,actorId:ids.l3,action:'retry',note:'Reenviar após nova conferência financeira.'});await repository.reviewBlockedResolution({resolutionId:retryProposal.id,actorId:ids.l4,action:'retry',note:'Manter reenvio após revisão administrativa.'});await repository.authorizeBlockedResolution({resolutionId:retryProposal.id,actorId:ids.l5,note:'Autorizar reenvio após três análises independentes.'});
  const executedRetry=await repository.executeAuthorizedResolution({resolutionId:retryProposal.id});assert.equal(executedRetry.result,'retry_queued');const retried=(await db.query('SELECT status,attempts,idempotency_key FROM courier_wallet_provider_commands WHERE id=$1',[fourthBlocked.id])).rows[0];assert.equal(retried.status,'pending');assert.equal(retried.attempts,0);assert.match(retried.idempotency_key,/^wallet-resolution-retry:/);
  balance=await repository.summary(ids.courier);assert.deepEqual({available:balance.available_cents,reserved:balance.reserved_cents},{available:1000,reserved:2000});
  assert.equal((await db.query("SELECT count(*)::int AS n FROM audit_events WHERE entity_id=$1 AND action='courier.wallet.blocked_resolution_proposed' AND metadata->>'fundsMoved'='false' AND metadata->>'providerCalled'='false'",[third.withdrawal.id])).rows[0].n,1);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM audit_events WHERE entity_id=$1 AND action='courier.wallet.blocked_resolution_level4_approved' AND metadata->>'modified'='true' AND metadata->>'fundsMoved'='false'",[third.withdrawal.id])).rows[0].n,1);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM audit_events WHERE entity_id=$1 AND action='courier.wallet.blocked_resolution_level5_authorized' AND metadata->>'authorizedAction'='return_to_wallet' AND metadata->>'providerCalled'='false'",[third.withdrawal.id])).rows[0].n,1);
  await assert.rejects(repository.reconcileProviderEvent({providerReferenceHash:'9'.repeat(64),status:'completed',evidenceSha256:'8'.repeat(64),idempotencyKey:'wallet-unknown-synthetic-0001'}),error=>error.code==='withdrawal_not_found');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM audit_events WHERE entity_id=$1 AND action='courier.wallet.provider_blocked' AND metadata->>'fundsRemainReserved'='true'",[third.withdrawal.id])).rows[0].n,1);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM audit_events WHERE entity_id=$1 AND metadata->>'providerCalled'='false'",[requested.withdrawal.id])).rows[0].n,4);
 }finally{await db.close();}});
});
