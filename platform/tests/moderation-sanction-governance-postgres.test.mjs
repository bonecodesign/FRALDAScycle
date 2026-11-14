import assert from 'node:assert/strict';
import test from 'node:test';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {createModerationRepository} from '../database/moderation-repository.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const ids={target:'11111111-1111-4111-8111-111111111111',level3:'33333333-3333-4333-8333-333333333333',level4:'44444444-4444-4444-8444-444444444444'};

test('level 3 proposes and distinct level 4 reviews a sanction without restricting the account',{skip:!native&&!process.env.CI?'PostgreSQL local indisponível.':false,timeout:60_000},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{const database=createDatabase({databaseUrl,databaseSsl:false});try{
    await migrate(database,await discoverMigrations());
    await database.query(`INSERT INTO users(id,email,password_hash,display_name,role,staff_access_level,staff_sector) VALUES
      ($1,'sanction-target@example.test','fixture','Conta alvo','customer',NULL,NULL),
      ($2,'sanction-level3@example.test','fixture','Moderação nível 3','admin',3,'moderation'),
      ($3,'sanction-level4@example.test','fixture','Moderação nível 4','admin',4,'moderation')`,[ids.target,ids.level3,ids.level4]);
    const repository=createModerationRepository(database);
    const proposal=await repository.proposeSanction({actorId:ids.level3,userId:ids.target,action:'permanent_block',until:null,reason:'Reincidência crítica sintética exige análise graduada.'});
    assert.equal(proposal.status,'proposed');
    assert.equal((await database.query('SELECT disabled_at FROM users WHERE id=$1',[ids.target])).rows[0].disabled_at,null);
    assert.equal((await database.query('SELECT count(*)::integer AS n FROM account_operation_restrictions WHERE user_id=$1',[ids.target])).rows[0].n,0);
    const until=new Date(Date.now()+86400000).toISOString();
    const review=await repository.reviewSanction({actorId:ids.level4,caseId:proposal.id,action:'temporary_suspension',until,reason:'Revisão proporcional reduziu a proposta para suspensão temporária.'});
    assert.equal(review.status,'level4_approved');assert.equal(review.level4_action,'temporary_suspension');
    assert.equal((await database.query('SELECT disabled_at FROM users WHERE id=$1',[ids.target])).rows[0].disabled_at,null);
    assert.equal((await database.query('SELECT count(*)::integer AS n FROM account_operation_restrictions WHERE user_id=$1',[ids.target])).rows[0].n,0);
    assert.equal((await database.query("SELECT count(*)::integer AS n FROM audit_events WHERE entity_id=$1 AND action IN('moderation.sanction.proposed','moderation.sanction.level4_reviewed') AND metadata->>'irreversibleActionApplied'='false'",[proposal.id])).rows[0].n,2);
    await assert.rejects(repository.reviewSanction({actorId:ids.level4,caseId:proposal.id,action:'warning',until:null,reason:'Revisão duplicada não pode substituir a decisão registrada.'}),error=>error.code==='moderation_sanction_not_reviewable');
  }finally{await database.close();}});
});
