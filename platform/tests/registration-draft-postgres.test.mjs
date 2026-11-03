import assert from 'node:assert/strict';
import test from 'node:test';
import {createRegistrationDraftService} from '../apps/api/registration-draft-service.js';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {createRegistrationDraftRepository} from '../database/registration-draft-repository.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const key=Buffer.alloc(32,11).toString('base64url');
const draft={fullName:'Maria da Silva',displayName:'Maria',contact:'maria@example.test',step:2,address:{postalCode:'30110-028',street:'Avenida Afonso Pena',number:'1000',complement:'Apto 10',noComplement:false,district:'Centro',city:'Belo Horizonte',state:'MG'}};

test('registration draft is encrypted and expires physically in PostgreSQL',{skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60_000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{const database=createDatabase({databaseUrl,databaseSsl:false});try{
  await migrate(database,await discoverMigrations());const repository=createRegistrationDraftRepository(database),service=createRegistrationDraftService(repository,{encryptionKey:key});
	  const saved=await service.save({draft}),stored=(await database.query(`SELECT encrypted_payload::text AS encrypted,extract(epoch FROM expires_at-created_at)::int AS ttl_seconds FROM responsible_registration_drafts`)).rows[0];
	  assert.doesNotMatch(stored.encrypted,/Maria|Afonso|example/);assert.equal(stored.ttl_seconds,86_400);
  assert.deepEqual((await service.resume({resumeToken:saved.resumeToken})).draft,draft);
  await database.query(`UPDATE responsible_registration_drafts SET expires_at=now()-interval '1 second'`);
  assert.deepEqual(await repository.purgeExpired(),{deleted:1});
  await assert.rejects(service.resume({resumeToken:saved.resumeToken}),error=>error.code==='registration_draft_unavailable');
 }finally{await database.close();}});
});

