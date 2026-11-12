import assert from 'node:assert/strict';import test from 'node:test';
import {createDatabase} from '../database/client.js';import {discoverMigrations,migrate} from '../database/migrate.js';
import {createCourierWalletRepository} from '../database/courier-wallet-repository.js';import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';
const native=await nativePostgresTools();
const ids={courier:'11111111-1111-4111-8111-111111111111',l3:'33333333-3333-4333-8333-333333333333',l4:'44444444-4444-4444-8444-444444444444',l5:'55555555-5555-4555-8555-555555555555',payout:'66666666-6666-4666-8666-666666666666'};

test('courier wallet reserves one weekly PIX withdrawal and follows 3 to 4 to 5 with PostgreSQL',{skip:!native&&!process.env.CI?'PostgreSQL local indisponível.':false,timeout:90_000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{const db=createDatabase({databaseUrl,databaseSsl:false});try{
  await migrate(db,await discoverMigrations());
  await db.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
   ($1,'wallet-courier@example.test','fixture','Entregador','courier'),
   ($2,'wallet-l3@example.test','fixture','Financeiro','admin'),
   ($3,'wallet-l4@example.test','fixture','Administrador','admin'),
   ($4,'wallet-l5@example.test','fixture','Fundador','admin')`,[ids.courier,ids.l3,ids.l4,ids.l5]);
  await db.query(`INSERT INTO courier_profiles(user_id,account_status,payout_status,payout_provider_reference)
   VALUES($1,'suspended','verified','provider-destination-synthetic')`,[ids.courier]);
  const repository=createCourierWalletRepository(db),hash='a'.repeat(64),evidence='b'.repeat(64);
  const credited=await repository.creditConfirmedPayout({courierId:ids.courier,payoutId:ids.payout,amountCents:5000,providerReferenceHash:hash,evidenceSha256:evidence,idempotencyKey:'wallet-credit-synthetic-0001'});
  assert.equal(credited.reused,false);assert.equal((await repository.summary(ids.courier)).available_cents,5000);
  const duplicate=await repository.creditConfirmedPayout({courierId:ids.courier,payoutId:ids.payout,amountCents:5000,providerReferenceHash:hash,evidenceSha256:evidence,idempotencyKey:'wallet-credit-synthetic-0001'});assert.equal(duplicate.reused,true);
  const requested=await repository.requestWithdrawal({courierId:ids.courier,amountCents:2000,idempotencyKey:'wallet-withdraw-synthetic-0001',now:new Date('2030-01-01T12:00:00Z')});
  assert.equal(requested.withdrawal.status,'requested');const summary=await repository.summary(ids.courier);assert.deepEqual({available:summary.available_cents,reserved:summary.reserved_cents,version:summary.version},{available:3000,reserved:2000,version:3});
  await assert.rejects(repository.requestWithdrawal({courierId:ids.courier,amountCents:2000,idempotencyKey:'wallet-withdraw-synthetic-0002',now:new Date('2030-01-08T11:59:59Z')}),error=>error.code==='withdrawal_weekly_limit');
  await assert.rejects(repository.advanceWithdrawal({withdrawalId:requested.withdrawal.id,actorId:ids.l4,accessLevel:4,note:'Tentativa fora da ordem aprovada.'}),error=>error.code==='withdrawal_stage_forbidden');
  assert.equal((await repository.advanceWithdrawal({withdrawalId:requested.withdrawal.id,actorId:ids.l3,accessLevel:3,note:'Análise financeira sintética concluída.'})).status,'level3_proposed');
  await assert.rejects(repository.advanceWithdrawal({withdrawalId:requested.withdrawal.id,actorId:ids.l3,accessLevel:4,note:'Tentativa sem independência entre as etapas.'}),error=>error.code==='withdrawal_independent_reviewer_required');
  assert.equal((await repository.advanceWithdrawal({withdrawalId:requested.withdrawal.id,actorId:ids.l4,accessLevel:4,note:'Aprovação administrativa sintética concluída.'})).status,'level4_approved');
  assert.equal((await repository.advanceWithdrawal({withdrawalId:requested.withdrawal.id,actorId:ids.l5,accessLevel:5,note:'Autorização final sintética concluída.'})).status,'level5_authorized');
  const stored=(await db.query('SELECT payout_destination_reference,provider_reference_hash,status FROM courier_wallet_withdrawals WHERE id=$1',[requested.withdrawal.id])).rows[0];assert.deepEqual(stored,{payout_destination_reference:'provider-destination-synthetic',provider_reference_hash:null,status:'level5_authorized'});
  assert.equal((await db.query("SELECT count(*)::int AS n FROM audit_events WHERE entity_id=$1 AND metadata->>'providerCalled'='false'",[requested.withdrawal.id])).rows[0].n,4);
 }finally{await db.close();}});
});
