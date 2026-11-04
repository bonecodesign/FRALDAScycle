import assert from 'node:assert/strict';
import test from 'node:test';
import {createDatabase} from '../database/client.js';
import {createModerationRepository,newOperationsAllowed} from '../database/moderation-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';
const native=await nativePostgresTools();
test('expired temporary suspension restores only its listings exactly once',{skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60_000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{const database=createDatabase({databaseUrl,databaseSsl:false});try{
  await migrate(database,await discoverMigrations());const owner='11111111-1111-4111-8111-111111111111',reviewer='22222222-2222-4222-8222-222222222222';
  await database.query("INSERT INTO users(id,email,password_hash,display_name,role) VALUES($1,'expiry-owner@example.test','fixture','Titular','customer'),($2,'expiry-reviewer@example.test','fixture','Revisor','admin')",[owner,reviewer]);
  const listing=(await database.query("INSERT INTO listings(seller_id,title,description,category,brand,model,package_condition,quantity,kind,price_cents,status) VALUES($1,'Anúncio temporário','Pausa associada a suspensão com expiração.','infant','Marca','Modelo','sealed',1,'sale',1000,'published') RETURNING id",[owner])).rows[0];
  const repository=createModerationRepository(database),until=new Date(Date.now()+3600000).toISOString();
  const suspended=await repository.suspend({actorId:reviewer,userId:owner,reason:'Suspensão temporária sintética com prazo explícito.',until,idempotencyKey:'moderation-expiry-postgres'});
  const overlapping=await repository.suspend({actorId:reviewer,userId:owner,reason:'Segunda suspensão temporária sintética e concorrente.',until:new Date(Date.now()+7200000).toISOString(),idempotencyKey:'moderation-overlap-postgres'});
  assert.equal(await database.transaction(client=>newOperationsAllowed(client,owner)),false);assert.equal((await database.query('SELECT status FROM listings WHERE id=$1',[listing.id])).rows[0].status,'paused');
  await database.query("UPDATE moderation_decisions SET suspended_until=now()-interval '1 second' WHERE id=$1",[suspended.decision.id]);
  assert.equal(await database.transaction(client=>newOperationsAllowed(client,owner)),false);
  assert.deepEqual(await repository.releaseExpired(),{released:1,restoredListings:0,permanentBansApplied:0});
  assert.equal((await database.query('SELECT status FROM listings WHERE id=$1',[listing.id])).rows[0].status,'paused');
  await database.query("UPDATE moderation_decisions SET suspended_until=now()-interval '1 second' WHERE id=$1",[overlapping.decision.id]);
  assert.equal(await database.transaction(client=>newOperationsAllowed(client,owner)),true);
  assert.deepEqual(await repository.releaseExpired(),{released:1,restoredListings:1,permanentBansApplied:0});
  assert.equal((await database.query('SELECT status FROM listings WHERE id=$1',[listing.id])).rows[0].status,'published');
  assert.deepEqual(await repository.releaseExpired(),{released:0,restoredListings:0,permanentBansApplied:0});
  assert.equal((await database.query("SELECT count(*)::integer AS n FROM audit_events WHERE action='moderation.account.released' AND entity_id=$1",[suspended.decision.id])).rows[0].n,1);
 }finally{await database.close();}});
});
