import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createAccountConsentService} from '../apps/api/account-consent-service.js';
import {createAccountConsentRepository} from '../database/account-consent-repository.js';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const ids={user:'11111111-1111-4111-8111-111111111111',other:'22222222-2222-4222-8222-222222222222'};
const terms={version:'FC-SYNTHETIC-TERMS-1',status:'active',contentHash:'a'.repeat(64),documents:[{name:'synthetic-terms.md',content:'Synthetic acceptance fixture; not legal terms.'}]};

test('synthetic account-terms history is private, versioned, idempotent and audited over HTTP/PostgreSQL',{
  skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const database=createDatabase({databaseUrl,databaseSsl:false});let api;
    try{
      await migrate(database,await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
        ($1,'terms-fixture@example.test','fixture','Conta fictícia','customer'),
        ($2,'terms-other@example.test','fixture','Outra conta fictícia','customer')`,[ids.user,ids.other]);
      const service=createAccountConsentService(createAccountConsentRepository(database),async()=>terms);
      const actors={owner:{id:ids.user,role:'customer'},other:{id:ids.other,role:'customer'}};
      api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),accountConsentService:service,
        authService:{async session(token){return actors[token]??null;}}});
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      const root=`http://127.0.0.1:${api.address().port}/v1/account`,headers=token=>({'content-type':'application/json',cookie:`fc_session=${token}`});
      assert.equal((await fetch(root+'/terms/history')).status,401);
      const current=await fetch(root+'/terms',{headers:headers('owner')});const currentBody=await current.json();
      assert.equal(current.status,200);assert.equal(currentBody.terms.contentHash,terms.contentHash);assert.equal(current.headers.get('cache-control'),'no-store');
      const payload={accepted:true,version:terms.version,contentHash:terms.contentHash};
      const accepted=await fetch(root+'/terms/accept',{method:'POST',headers:headers('owner'),body:JSON.stringify(payload)});
      const acceptance=await accepted.json();assert.equal(accepted.status,201);assert.equal(acceptance.acceptance.version,terms.version);assert.equal(acceptance.acceptance.content_hash,terms.contentHash);
      const retry=await fetch(root+'/terms/accept',{method:'POST',headers:headers('owner'),body:JSON.stringify(payload)});
      assert.equal(retry.status,200);assert.equal((await retry.json()).reused,true);
      const mismatch=await fetch(root+'/terms/accept',{method:'POST',headers:headers('owner'),body:JSON.stringify({...payload,contentHash:'b'.repeat(64)})});assert.equal(mismatch.status,422);
      const ownHistory=await fetch(root+'/terms/history',{headers:headers('owner')});const ownBody=await ownHistory.json();
      assert.equal(ownHistory.status,200);assert.equal(ownBody.items.length,1);assert.equal(ownBody.items[0].version,terms.version);assert.equal(ownBody.items[0].document_snapshot,undefined);
      const privateHistory=await fetch(root+'/terms/history',{headers:headers('other')});assert.deepEqual((await privateHistory.json()).items,[]);
      const stored=(await database.query('SELECT version,content_hash,document_snapshot FROM terms_acceptances WHERE user_id=$1',[ids.user])).rows[0];
      assert.deepEqual(stored,{version:terms.version,content_hash:terms.contentHash,document_snapshot:terms.documents});
      assert.equal((await database.query("SELECT count(*)::integer AS n FROM audit_events WHERE action='account.terms.accepted' AND actor_user_id=$1",[ids.user])).rows[0].n,1);
      assert.equal((await database.query('SELECT count(*)::integer AS n FROM terms_acceptances')).rows[0].n,1);
    }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
  });
});
