import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomBytes} from 'node:crypto';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {createAuthRepository} from '../database/auth-repository.js';

const databaseUrl=process.env.FC_LISTING_TEST_DATABASE_URL;
test('PostgreSQL serializes MFA issuance, attempt limits and atomic session confirmation',{
  skip:!databaseUrl?'Banco temporário de validação não configurado.':false,timeout:60000,
},async()=>{
  const url=new URL(databaseUrl);assert.equal(url.pathname,'/fc_listing_creation_test');assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
  const database=createDatabase({databaseUrl,databaseSsl:false});
  const hash=value=>createHash('sha256').update(value).digest();
  const owner='10000000-0000-4000-8000-000000000003';
  try{
    await migrate(database,await discoverMigrations());
    await database.query("INSERT INTO users(id,email,password_hash,display_name,role) VALUES($1,'mfa-synthetic@example.test','unusable-synthetic','Administrador fictício','admin')",[owner]);
    const repository=createAuthRepository(database),expiresAt=new Date(Date.now()+60_000);
    await Promise.all(Array.from({length:10},(_,index)=>repository.createAuthToken({userId:owner,kind:'admin_login_mfa',tokenHash:hash(`synthetic-${index}`),expiresAt})));
    const active=(await database.query("SELECT token_hash FROM auth_tokens WHERE user_id=$1 AND kind='admin_login_mfa' AND consumed_at IS NULL",[owner])).rows;
    assert.equal(active.length,1);
    const attemptHash=hash('one-valid-challenge');
    const results=await Promise.all(Array.from({length:20},()=>repository.confirmAdminMfaSession({tokenHash:active[0].token_hash,attemptHash,maxAttempts:5,sessionTokenHash:randomBytes(32),expiresAt})));
    assert.equal(results.filter(result=>result.user).length,1);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM sessions WHERE user_id=$1',[owner])).rows[0].count,1);
    const wrongAttempt=hash('one-invalid-challenge');
    const wrong=await Promise.all(Array.from({length:20},()=>repository.confirmAdminMfaSession({tokenHash:hash('invalid-token'),attemptHash:wrongAttempt,maxAttempts:5,sessionTokenHash:randomBytes(32),expiresAt})));
    assert.equal(wrong.filter(result=>result.limited).length,15);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM login_attempts WHERE email_hash=$1 AND succeeded=false',[wrongAttempt])).rows[0].count,5);
    console.log('MFA: 10 emissões deixaram 1 desafio ativo; 20 confirmações geraram 1 sessão; limite concorrente respeitado.');
    const tokenHash=hash('rollback-token'),rollbackAttempt=hash('rollback-challenge');
    await repository.createAuthToken({userId:owner,kind:'admin_login_mfa',tokenHash,expiresAt});
    await database.query(`CREATE FUNCTION reject_test_session() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.user_agent='rollback-marker' THEN RAISE EXCEPTION 'synthetic session failure'; END IF; RETURN NEW; END $$`);
    await database.query('CREATE TRIGGER reject_test_session BEFORE INSERT ON sessions FOR EACH ROW EXECUTE FUNCTION reject_test_session()');
    const request={tokenHash,attemptHash:rollbackAttempt,maxAttempts:5,sessionTokenHash:randomBytes(32),expiresAt,userAgent:'rollback-marker'};
    await assert.rejects(repository.confirmAdminMfaSession(request),/synthetic session failure/);
    assert.equal((await database.query('SELECT consumed_at FROM auth_tokens WHERE token_hash=$1',[tokenHash])).rows[0].consumed_at,null);
    await database.query('DROP TRIGGER reject_test_session ON sessions');
    assert.ok((await repository.confirmAdminMfaSession(request)).user);
    for(const update of ["disabled_at=now()","disabled_at=NULL,role='customer'"]){
      const blockedHash=randomBytes(32);await repository.createAuthToken({userId:owner,kind:'admin_login_mfa',tokenHash:blockedHash,expiresAt});
      await database.query(`UPDATE users SET ${update} WHERE id=$1`,[owner]);
      assert.equal((await repository.confirmAdminMfaSession({...request,tokenHash:blockedHash,attemptHash:randomBytes(32),sessionTokenHash:randomBytes(32),userAgent:null})).user,null);
    }
    console.log('MFA: falha de sessão preservou o código; conta suspensa ou sem papel elevado foi bloqueada.');
  }finally{await database.close()}
});
