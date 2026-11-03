import assert from 'node:assert/strict';
import test from 'node:test';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';
const native=await nativePostgresTools();
test('PostgreSQL fixes content deadlines and enforces a single sequential hold',{skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60_000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{const database=createDatabase({databaseUrl,databaseSsl:false});try{
  await migrate(database,await discoverMigrations());
  const users=['11111111-1111-4111-8111-111111111111','31111111-1111-4111-8111-111111111111','41111111-1111-4111-8111-111111111111','51111111-1111-4111-8111-111111111111'];
  for(let index=0;index<users.length;index++)await database.query("INSERT INTO users(id,email,password_hash,display_name,role,staff_access_level) VALUES($1,$2,'fixture',$3,'admin',$4)",[users[index],'content-'+index+'@example.test','Nível '+(index||1),index===0?1:index+2]);
  const listing=(await database.query("INSERT INTO listings(seller_id,title,description,category,brand,model,package_condition,quantity,kind,price_cents,status) VALUES($1,'Anúncio sintético','Conteúdo de teste sem dados reais.','infant','Marca','Modelo','sealed',1,'sale',1000,'review') RETURNING id",[users[0]])).rows[0];
  await database.query("UPDATE listings SET status='removed',updated_at='2030-01-01T12:00:00Z' WHERE id=$1",[listing.id]);
  await database.query("UPDATE listing_content_retention SET party_access_until='2030-01-08T12:00:00Z' WHERE listing_id=$1",[listing.id]);
  const retention=(await database.query("SELECT * FROM listing_content_retention WHERE listing_id=$1",[listing.id])).rows[0];
  assert.equal((new Date(retention.cdn_purge_due_at)-new Date(retention.public_revoked_at))/3600000,24);
  assert.equal((new Date(retention.backup_expire_by)-new Date(retention.public_revoked_at))/86400000,30);
  await assert.rejects(database.query("INSERT INTO listing_content_retention(listing_id,public_revoked_at,cdn_purge_due_at,backup_expire_by) VALUES($1,now(),now()+interval '2 days',now()+interval '30 days')",[listing.id]),error=>['23505','23514'].includes(error.code));
  const hold=(await database.query("INSERT INTO listing_content_holds(listing_id,case_reference,justification,requested_by,requested_expires_at) VALUES($1,'CASE-TEST-1','Disputa formal sintética exige preservação temporária.',$2,now()+interval '30 days') RETURNING *",[listing.id,users[1]])).rows[0];
  await assert.rejects(database.query("INSERT INTO listing_content_holds(listing_id,case_reference,justification,requested_by,requested_expires_at) VALUES($1,'CASE-TEST-2','Segunda retenção concorrente deve ser recusada.',$2,now()+interval '30 days')",[listing.id,users[1]]),error=>error.code==='23505');
  await database.query("INSERT INTO listing_content_hold_decisions(hold_id,actor_id,stage,approved,note) VALUES($1,$2,'level4',true,'Nível quatro aprovou o prazo.')",[hold.id,users[2]]);
  await database.query("UPDATE listing_content_holds SET status='pending_level5',updated_at=now() WHERE id=$1",[hold.id]);
  await database.query("INSERT INTO listing_content_hold_decisions(hold_id,actor_id,stage,approved,note) VALUES($1,$2,'level5',true,'Fundador autorizou o prazo final.')",[hold.id,users[3]]);
  const active=(await database.query("UPDATE listing_content_holds SET status='active',activated_at=now(),effective_expires_at=requested_expires_at,updated_at=now() WHERE id=$1 RETURNING status",[hold.id])).rows[0];assert.equal(active.status,'active');
 }finally{await database.close();}});
});
