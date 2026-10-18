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
const ids={owner:'11111111-1111-4111-8111-111111111111',outsider:'22222222-2222-4222-8222-222222222222'};
const syntheticTerms={version:'synthetic-acceptance-v1',status:'active',contentHash:'c'.repeat(64),documents:[
  {name:'synthetic-terms',content:'Synthetic test document; not approved for production.'},
  {name:'synthetic-privacy',content:'Synthetic privacy document; not approved for production.'},
]};

test('terms acceptance is versioned, private and idempotent over HTTP/PostgreSQL without activating live terms',{
  skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const database=createDatabase({databaseUrl,databaseSsl:false});let api;
    try{
      await migrate(database,await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
        ($1,'terms-owner@example.test','fixture','Titular fictício','customer'),
        ($2,'terms-outsider@example.test','fixture','Pessoa externa','customer')`,[ids.owner,ids.outsider]);
      const repository=createAccountConsentRepository(database);
      const service=createAccountConsentService(repository,async()=>syntheticTerms);
      const actors={owner:{id:ids.owner,role:'customer'},outsider:{id:ids.outsider,role:'customer'}};
      api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),accountConsentService:service,authService:{async session(token){return actors[token]??null;}}});
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      const origin=`http://127.0.0.1:${api.address().port}/v1/account`,headers=token=>({'content-type':'application/json',cookie:`fc_session=${token}`});
      assert.equal((await fetch(origin+'/terms')).status,401);
      const current=await fetch(origin+'/terms',{headers:headers('owner')});const termsBody=await current.json();
      assert.equal(current.status,200);assert.equal(current.headers.get('cache-control'),'no-store');
      assert.equal(termsBody.terms.version,syntheticTerms.version);assert.equal(termsBody.terms.contentHash,syntheticTerms.contentHash);
      const mismatch=await fetch(origin+'/terms/accept',{method:'POST',headers:headers('owner'),body:JSON.stringify({accepted:true,version:syntheticTerms.version,contentHash:'d'.repeat(64)})});
      assert.equal(mismatch.status,422);
      const payload={accepted:true,version:syntheticTerms.version,contentHash:syntheticTerms.contentHash};
      const firstResponse=await fetch(origin+'/terms/accept',{method:'POST',headers:headers('owner'),body:JSON.stringify(payload)});
      const first=await firstResponse.json();assert.equal(firstResponse.status,201,JSON.stringify(first));assert.equal(first.reused,false);
      assert.equal(first.acceptance.version,syntheticTerms.version);assert.equal(first.acceptance.content_hash,syntheticTerms.contentHash);
      const repeatedResponse=await fetch(origin+'/terms/accept',{method:'POST',headers:headers('owner'),body:JSON.stringify(payload)});
      const repeated=await repeatedResponse.json();assert.equal(repeatedResponse.status,200);assert.equal(repeated.reused,true);
      assert.equal(repeated.acceptance.id,first.acceptance.id);assert.equal(repeated.acceptance.accepted_at,first.acceptance.accepted_at);
      const historyResponse=await fetch(origin+'/terms/history',{headers:headers('owner')});const history=await historyResponse.json();
      assert.equal(historyResponse.status,200);assert.equal(historyResponse.headers.get('cache-control'),'no-store');
      assert.equal(history.items.length,1);assert.equal(history.items[0].id,first.acceptance.id);
      const outsiderHistory=await fetch(origin+'/terms/history',{headers:headers('outsider')});assert.deepEqual((await outsiderHistory.json()).items,[]);
      assert.equal((await fetch(origin+'/terms/history')).status,401);
      const snapshot=(await database.query('SELECT document_snapshot FROM terms_acceptances WHERE id=$1',[first.acceptance.id])).rows[0].document_snapshot;
      assert.deepEqual(snapshot,syntheticTerms.documents);
      assert.equal((await database.query('SELECT count(*)::integer AS n FROM audit_events WHERE action=\'account.terms.accepted\' AND entity_id=$1',[first.acceptance.id])).rows[0].n,1);
      assert.equal((await database.query('SELECT count(*)::integer AS n FROM account_marketing_preferences WHERE user_id=$1',[ids.owner])).rows[0].n,0);
      assert.equal((await database.query('SELECT count(*)::integer AS n FROM marketing_preference_events WHERE user_id=$1',[ids.owner])).rows[0].n,0);
    }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
  });
});
