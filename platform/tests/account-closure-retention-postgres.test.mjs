import assert from 'node:assert/strict';
import test from 'node:test';
import {createAccountClosureRepository} from '../database/account-closure-repository.js';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();

test('account closure waits for content retention and then prepares a classified non-erasure inventory',{skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60_000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{const database=createDatabase({databaseUrl,databaseSsl:false});try{
  await migrate(database,await discoverMigrations());
  const userId='11111111-1111-4111-8111-111111111111',reviewerId='31111111-1111-4111-8111-111111111111';
  await database.query("INSERT INTO users(id,email,password_hash,display_name,role) VALUES($1,'closure-retention@example.test','fixture','Titular sintético','customer'),($2,'closure-reviewer@example.test','fixture','Revisor sintético','admin')",[userId,reviewerId]);
  const listing=(await database.query("INSERT INTO listings(seller_id,title,description,category,brand,model,package_condition,quantity,kind,price_cents,status) VALUES($1,'Anúncio sintético','Conteúdo para inventário de encerramento.','infant','Marca','Modelo','sealed',1,'sale',1000,'removed') RETURNING id",[userId])).rows[0];
  const hold=(await database.query("INSERT INTO listing_content_holds(listing_id,case_reference,justification,requested_by,requested_expires_at) VALUES($1,'CLOSURE-HOLD-1','Retenção sintética bloqueia o encerramento até revisão.',$2,now()+interval '30 days') RETURNING id",[listing.id,reviewerId])).rows[0];
  const closure=(await database.query("INSERT INTO account_closure_requests(user_id,idempotency_key,notice_version,requested_at,cancel_until) VALUES($1,'closure-retention-postgres','FC-ACCOUNT-CLOSURE-1',now()-interval '8 days',now()-interval '1 day') RETURNING id",[userId])).rows[0];
  const repository=createAccountClosureRepository(database);

  const blocked=await repository.reviewDue({requestId:closure.id,userId});
  assert.equal(blocked.status,'awaiting_obligations');
  assert.equal(blocked.obligations.content_holds,1);
  assert.equal((await database.query('SELECT count(*)::int AS n FROM account_closure_data_inventories WHERE closure_request_id=$1',[closure.id])).rows[0].n,0);

  await database.query("UPDATE listing_content_holds SET status='rejected',updated_at=now() WHERE id=$1",[hold.id]);
  const ready=await repository.reviewDue({requestId:closure.id,userId});
  assert.equal(ready.status,'ready_for_review');
  const inventory=(await database.query('SELECT inventory,classification_version,automatic_erasure_allowed FROM account_closure_data_inventories WHERE closure_request_id=$1',[closure.id])).rows[0];
  assert.equal(inventory.classification_version,'FC-CLOSURE-INVENTORY-2');
  assert.equal(inventory.automatic_erasure_allowed,false);
  assert.equal(inventory.inventory.classification,'awaiting_legal_review');
  assert.equal(inventory.inventory.marketplaceContent.listings,1);
  assert.equal(inventory.inventory.marketplaceContent.holds,1);
  assert.equal(inventory.inventory.marketplaceContent.classification,'operation_dispute_or_legal_hold');
  const plan=(await database.query('SELECT policy_version,policy_status,plan,execution_allowed,automatic_erasure_allowed FROM account_closure_retention_plans WHERE closure_request_id=$1',[closure.id])).rows[0];
  assert.equal(plan.policy_version,'FC-CLOSURE-RETENTION-1');
  assert.equal(plan.policy_status,'pending_professional_review');
  assert.equal(plan.execution_allowed,false);
  assert.equal(plan.automatic_erasure_allowed,false);
  assert.equal(plan.plan.categories.find(item=>item.category==='transactions').retentionDays,1825);
  assert.equal(plan.plan.categories.find(item=>item.category==='child_profiles').backupExpiryDays,30);
  assert.equal((await database.query('SELECT count(*)::int AS n FROM users WHERE id=$1',[userId])).rows[0].n,1);

  const repeated=await repository.reviewDue({requestId:closure.id,userId});
  assert.equal(repeated.changed,false);
  assert.equal((await database.query('SELECT count(*)::int AS n FROM account_closure_data_inventories WHERE closure_request_id=$1',[closure.id])).rows[0].n,1);
  assert.equal((await database.query('SELECT count(*)::int AS n FROM account_closure_retention_plans WHERE closure_request_id=$1',[closure.id])).rows[0].n,1);
 }finally{await database.close();}});
});
