import assert from 'node:assert/strict';
import test from 'node:test';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {createAdminWorkItemRepository} from '../database/admin-work-item-repository.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const ids={finance:'11111111-1111-4111-8111-111111111111',support:'22222222-2222-4222-8222-222222222222',technical:'33333333-3333-4333-8333-333333333333',founder:'55555555-5555-4555-8555-555555555555'};

test('admin queue isolates sector details while preserving status visibility and founder oversight',{skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60_000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{const database=createDatabase({databaseUrl,databaseSsl:false});try{
  await migrate(database,await discoverMigrations());
  for(const [sector,id] of Object.entries(ids)){const level=sector==='founder'?5:sector==='support'?1:3;await database.query(`INSERT INTO users(id,email,password_hash,display_name,role,staff_access_level,staff_sector,adult_declaration_version,adult_declared_at) VALUES($1,$2,'fixture',$3,'admin',$4,$5,'FC-AGE-1',now())`,[id,`${sector}@example.test`,sector,level,sector]);}
  const repository=createAdminWorkItemRepository(database);
  const created=await repository.create({actorId:ids.finance,sector:'support',kind:'refund_review',title:'Revisar reembolso',context:'Conteúdo já minimizado',priority:'high',dueAt:null});
  const financeView=await repository.list({actorId:ids.finance});
  assert.equal(financeView.items[0].status,'new');
  assert.equal(financeView.items[0].details_visible,false);
  assert.equal(financeView.items[0].title,null);
  assert.equal(financeView.items[0].priority,null);
  assert.equal(financeView.items[0].source_sector,null);
  assert.equal(financeView.items[0].version,null);
  await assert.rejects(()=>repository.claim({actorId:ids.finance,id:created.id,expectedVersion:0}),error=>error.code==='cross_sector_details_forbidden');
  const claimed=await repository.claim({actorId:ids.support,id:created.id,expectedVersion:0});
  assert.equal(claimed.assigned_to,ids.support);
  const triage=await repository.transition({actorId:ids.support,id:created.id,expectedVersion:1,status:'triage',note:'Triagem iniciada pela equipe responsável.'});
  assert.equal(triage.status,'triage');
  await assert.rejects(()=>repository.transition({actorId:ids.support,id:created.id,expectedVersion:2,status:'closed',note:'Tentativa de pular o fluxo operacional.'}),error=>error.code==='admin_work_item_transition_forbidden');
  const founderView=await repository.list({actorId:ids.founder});
  assert.equal(founderView.items[0].details_visible,true);
  assert.equal(founderView.items[0].title,'Revisar reembolso');
  const supportView=await repository.list({actorId:ids.support});
  assert.equal(supportView.items[0].details_visible,true);
  assert.equal(supportView.items[0].assignee_name,'support');
  const events=(await database.query('SELECT event_type FROM admin_work_item_events WHERE work_item_id=$1 ORDER BY id',[created.id])).rows.map(row=>row.event_type);
  assert.deepEqual(events,['created','claimed','status_changed']);
 }finally{await database.close();}});
});
