import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createChildProfileService} from '../apps/api/child-profile-service.js';
import {createChildProfileRepository} from '../database/child-profile-repository.js';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const owner='11111111-1111-4111-8111-111111111111';
const outsider='22222222-2222-4222-8222-222222222222';
const courier='33333333-3333-4333-8333-333333333333';
const admin='44444444-4444-4444-8444-444444444444';

test('disabled child-profile foundation minimizes data and isolates accounts over HTTP/PostgreSQL',{
  skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const database=createDatabase({databaseUrl,databaseSsl:false});let api;
    try{
      await migrate(database,await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name,role,adult_declaration_version,adult_declared_at) VALUES
        ($1,'family-owner@example.test','fixture','Responsável fictício','customer','FC-AGE-1',now()),
        ($2,'family-outsider@example.test','fixture','Terceiro fictício','customer','FC-AGE-1',now()),
        ($3,'courier@example.test','fixture','Entregador fictício','courier','FC-AGE-1',now()),
        ($4,'admin@example.test','fixture','Admin fictício','admin','FC-AGE-1',now())`,[owner,outsider,courier,admin]);
      const service=createChildProfileService(createChildProfileRepository(database),{featureEnabled:true,now:()=>new Date('2026-10-16T12:00:00Z')});
      const actors={owner:{id:owner,role:'customer',adultDeclared:true},outsider:{id:outsider,role:'customer',adultDeclared:true},courier:{id:courier,role:'courier',adultDeclared:true},admin:{id:admin,role:'admin',adultDeclared:true}};
      api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),childProfileService:service,authService:{async session(token){return actors[token]??null;}}});
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      const root=`http://127.0.0.1:${api.address().port}/v1/account/child-profiles`;
      const headers=token=>({cookie:`fc_session=${token}`,'content-type':'application/json'});
      assert.equal((await fetch(root)).status,401);
      const rejected=await fetch(root,{method:'POST',headers:headers('owner'),body:JSON.stringify({birthDate:'2026-04-16',emoji:'🍼',label:'não permitido',consentConfirmed:true,consentVersion:'FC-CHILD-PROFILE-1',personalizationEnabled:true})});
      assert.equal(rejected.status,422);
      assert.equal((await fetch(root,{method:'POST',headers:headers('courier'),body:JSON.stringify({birthDate:'2026-04-16',emoji:'🍼',consentConfirmed:true,consentVersion:'FC-CHILD-PROFILE-1',personalizationEnabled:true})})).status,403);
      assert.equal((await fetch(root,{headers:headers('admin')})).status,403);
      const createdResponse=await fetch(root,{method:'POST',headers:headers('owner'),body:JSON.stringify({birthDate:'2026-04-16',emoji:'🍼',consentConfirmed:true,consentVersion:'FC-CHILD-PROFILE-1',personalizationEnabled:true})});
      const createdBody=await createdResponse.json();const created=createdBody.profile;assert.equal(createdResponse.status,201,JSON.stringify(createdBody));assert.equal(created.birthDate,'2026-04-16');assert.equal(created.emoji,'🍼');assert.equal(created.ageDisplay,'6 meses');assert.equal(created.ageBand,'infant_6_11');assert.equal('label' in created,false);assert.equal(createdResponse.headers.get('cache-control'),'no-store');
      const secondResponse=await fetch(root,{method:'POST',headers:headers('owner'),body:JSON.stringify({birthDate:'2025-04-16',emoji:'🧸',consentConfirmed:true,consentVersion:'FC-CHILD-PROFILE-1',personalizationEnabled:true})});
      const second=(await secondResponse.json()).profile;assert.equal(secondResponse.status,201);assert.notEqual(second.id,created.id);
      const ownerList=await fetch(root,{headers:headers('owner')}),ownerBody=await ownerList.json();assert.equal(ownerList.status,200);assert.equal(ownerBody.items.length,2);
      const outsiderBody=await (await fetch(root,{headers:headers('outsider')})).json();assert.deepEqual(outsiderBody.items,[]);
      const updatedResponse=await fetch(`${root}/${created.id}`,{method:'PUT',headers:headers('owner'),body:JSON.stringify({birthDate:'2026-05-16',emoji:'⭐',expectedVersion:1})});assert.equal(updatedResponse.status,200);assert.equal((await updatedResponse.json()).profile.version,2);
      assert.equal((await fetch(`${root}/${created.id}`,{method:'PUT',headers:headers('outsider'),body:JSON.stringify({birthDate:'2026-06-16',emoji:'🌙',expectedVersion:2})})).status,404);
      const removedResponse=await fetch(`${root}/${created.id}`,{method:'DELETE',headers:headers('owner'),body:JSON.stringify({confirmed:true,expectedVersion:2})});assert.equal(removedResponse.status,200);assert.equal((await removedResponse.json()).removed,true);
      const remaining=await (await fetch(root,{headers:headers('owner')})).json();assert.equal(remaining.items.length,1);assert.equal(remaining.items[0].id,second.id);
      assert.equal((await fetch(`${root}/${second.id}`,{method:'DELETE',headers:headers('owner'),body:JSON.stringify({confirmed:true,expectedVersion:1})})).status,200);
      const retained=await database.query(`SELECT birth_date,deleted_at,personalization_enabled FROM child_profiles WHERE account_id=$1 ORDER BY created_at`,[owner]);
      assert.equal(retained.rows.length,2);for(const row of retained.rows){assert.equal(row.birth_date,null);assert.ok(row.deleted_at);assert.equal(row.personalization_enabled,false);}
      assert.equal(await createChildProfileRepository(database).hasActive(owner),false);
      assert.equal(await createChildProfileRepository(database).operationProfileState(owner),'missing');
      assert.equal((await database.query(`SELECT count(*)::integer AS count FROM information_schema.columns WHERE table_name='child_profiles' AND column_name='label'`)).rows[0].count,0);
      assert.equal((await database.query(`SELECT count(*)::integer AS count FROM audit_events WHERE entity_type='child_profile'`)).rows[0].count,5);
      const consentEvidence=await database.query(`SELECT consent_version,content_hash,accepted_at,account_closed_at,retention_due_at FROM child_profile_consent_evidence WHERE account_id=$1 ORDER BY accepted_at,id`,[owner]);
      assert.equal(consentEvidence.rows.length,2);
      for(const evidence of consentEvidence.rows){
        assert.equal(evidence.consent_version,'FC-CHILD-PROFILE-1');
        assert.equal(evidence.content_hash,'8197091ecfc2d058d76411092a11ad577ea04dce7548759537ba52335161593a');
        assert.ok(evidence.accepted_at instanceof Date);assert.equal(evidence.account_closed_at,null);assert.equal(evidence.retention_due_at,null);
      }
      const evidenceColumns=(await database.query(`SELECT column_name FROM information_schema.columns WHERE table_name='child_profile_consent_evidence' ORDER BY column_name`)).rows.map(row=>row.column_name);
      assert.equal(evidenceColumns.includes('birth_date'),false);assert.equal(evidenceColumns.includes('emoji'),false);
      const notices=await database.query(`SELECT message,created_at,expires_at FROM account_notices WHERE user_id=$1 AND kind='child_profile_change' ORDER BY created_at`,[owner]);
      assert.equal(notices.rows.length,5);
      assert.deepEqual(notices.rows.map(row=>row.message),[
        'Um perfil da família foi criado.',
        'Um perfil da família foi criado.',
        'Um perfil da família foi atualizado.',
        'Um perfil da família foi removido.',
        'Um perfil da família foi removido.',
      ]);
      for(const notice of notices.rows){
        assert.doesNotMatch(notice.message,/\d{4}-\d{2}-\d{2}|nascimento|birth/i);
        const retentionMs=new Date(notice.expires_at).getTime()-new Date(notice.created_at).getTime();
        assert.ok(retentionMs>=365*24*60*60*1000&&retentionMs<=366*24*60*60*1000);
      }
      // The family-specific endpoint must not disclose payments/disputes,
      // another account's notices, or expired child-profile notices.
      await database.query(`INSERT INTO account_notices(user_id,kind,message,dedupe_key,expires_at) VALUES
        ($1,'child_profile_change','family-synthetic-active','scope-family-active',now()+interval '1 day'),
        ($1,'child_profile_change','family-synthetic-expired','scope-family-expired',now()-interval '1 day'),
        ($1,'child_profile_age_limit','family-synthetic-age-limit','scope-family-age-limit',NULL),
        ($1,'child_profile_responsibility','family-synthetic-responsibility','scope-family-responsibility',now()+interval '1 day'),
        ($1,'exchange_difference_payment','payment-synthetic-private','scope-payment-private',NULL),
        ($2,'child_profile_change','other-account-synthetic-private','scope-other-account',now()+interval '1 day')`,
        [owner,outsider]);
      const noticeUrl=root.replace('/child-profiles','/child-profile-notices');
      const familyResponse=await fetch(noticeUrl,{headers:headers('owner')});
      assert.equal(familyResponse.status,200);
      assert.equal(familyResponse.headers.get('cache-control'),'no-store');
      const familyResult=await familyResponse.json();
      const visible=familyResult.items.map(item=>item.message);
      assert.equal(visible.length,8);
      assert.ok(visible.includes('family-synthetic-active'));
      assert.ok(visible.includes('family-synthetic-age-limit'));
      assert.ok(visible.includes('family-synthetic-responsibility'));
      for(const privateMessage of [
        'family-synthetic-expired','payment-synthetic-private','other-account-synthetic-private'
      ]) assert.equal(visible.includes(privateMessage),false);
      const otherNoticeResult=await (await fetch(noticeUrl,{headers:headers('outsider')})).json();
      assert.deepEqual(otherNoticeResult.items.map(item=>item.message),['other-account-synthetic-private']);
      assert.equal((await fetch(noticeUrl,{headers:headers('courier')})).status,403);
      const expiredStillStored=(await database.query(`SELECT count(*)::integer AS total
        FROM account_notices WHERE user_id=$1 AND message='family-synthetic-expired'`,[owner])).rows[0];
      assert.equal(expiredStillStored.total,1,'Reading notices must never delete account data');

      const childAudit=(await database.query(`SELECT action,metadata FROM audit_events
        WHERE actor_user_id=$1 AND entity_type='child_profile'`,[owner])).rows;
      assert.equal(childAudit.filter(row=>row.action==='child_profile.created').length,2);
      for(const event of childAudit) {
        const metadata=JSON.stringify(event.metadata);
        assert.doesNotMatch(metadata,/2025-04-16|2026-04-16|2026-05-16|birthDate|birth_date|emoji|🍼|🧸|⭐/i);
      }

    }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
  });
});
