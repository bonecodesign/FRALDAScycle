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
      const rejected=await fetch(root,{method:'POST',headers:headers('owner'),body:JSON.stringify({birthDate:'2026-04-16',label:'não permitido',consentConfirmed:true,consentVersion:'FC-CHILD-PROFILE-1',personalizationEnabled:true})});
      assert.equal(rejected.status,422);
      assert.equal((await fetch(root,{method:'POST',headers:headers('courier'),body:JSON.stringify({birthDate:'2026-04-16',consentConfirmed:true,consentVersion:'FC-CHILD-PROFILE-1',personalizationEnabled:true})})).status,403);
      assert.equal((await fetch(root,{headers:headers('admin')})).status,403);
      const createdResponse=await fetch(root,{method:'POST',headers:headers('owner'),body:JSON.stringify({birthDate:'2026-04-16',consentConfirmed:true,consentVersion:'FC-CHILD-PROFILE-1',personalizationEnabled:true})});
      const createdBody=await createdResponse.json();const created=createdBody.profile;assert.equal(createdResponse.status,201,JSON.stringify(createdBody));assert.equal(created.birthDate,'2026-04-16');assert.equal(created.ageBand,'infant_6_11');assert.equal('label' in created,false);assert.equal(createdResponse.headers.get('cache-control'),'no-store');
      const secondResponse=await fetch(root,{method:'POST',headers:headers('owner'),body:JSON.stringify({birthDate:'2025-04-16',consentConfirmed:true,consentVersion:'FC-CHILD-PROFILE-1',personalizationEnabled:true})});
      const second=(await secondResponse.json()).profile;assert.equal(secondResponse.status,201);assert.notEqual(second.id,created.id);
      const ownerList=await fetch(root,{headers:headers('owner')}),ownerBody=await ownerList.json();assert.equal(ownerList.status,200);assert.equal(ownerBody.items.length,2);
      const outsiderBody=await (await fetch(root,{headers:headers('outsider')})).json();assert.deepEqual(outsiderBody.items,[]);
      const updatedResponse=await fetch(`${root}/${created.id}`,{method:'PUT',headers:headers('owner'),body:JSON.stringify({birthDate:'2026-05-16',expectedVersion:1})});assert.equal(updatedResponse.status,200);assert.equal((await updatedResponse.json()).profile.version,2);
      assert.equal((await fetch(`${root}/${created.id}`,{method:'PUT',headers:headers('outsider'),body:JSON.stringify({birthDate:'2026-06-16',expectedVersion:2})})).status,404);
      const removedResponse=await fetch(`${root}/${created.id}`,{method:'DELETE',headers:headers('owner'),body:JSON.stringify({confirmed:true,expectedVersion:2})});assert.equal(removedResponse.status,200);assert.equal((await removedResponse.json()).removed,true);
      const remaining=await (await fetch(root,{headers:headers('owner')})).json();assert.equal(remaining.items.length,1);assert.equal(remaining.items[0].id,second.id);
      assert.equal((await fetch(`${root}/${second.id}`,{method:'DELETE',headers:headers('owner'),body:JSON.stringify({confirmed:true,expectedVersion:1})})).status,200);
      const emptyResponse=await fetch(root,{headers:headers('owner')}),emptyBody=await emptyResponse.json();assert.equal(emptyResponse.status,200);assert.deepEqual(emptyBody.items,[]);
      assert.equal((await database.query(`SELECT count(*)::integer AS count FROM information_schema.columns WHERE table_name='child_profiles' AND column_name='label'`)).rows[0].count,0);
      assert.equal((await database.query(`SELECT count(*)::integer AS count FROM audit_events WHERE entity_type='child_profile'`)).rows[0].count,5);
    }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
  });
});
