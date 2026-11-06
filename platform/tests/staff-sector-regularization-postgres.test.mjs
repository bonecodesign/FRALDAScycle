import assert from 'node:assert/strict';
import test from 'node:test';
import {randomBytes} from 'node:crypto';
import {createDatabase} from '../database/client.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {createAccountStepUpRepository} from '../database/account-step-up-repository.js';
import {createStaffAccessRepository} from '../database/staff-access-repository.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools(),ids={target:'11111111-1111-4111-8111-111111111111',admin:'44444444-4444-4444-8444-444444444444',founder:'55555555-5555-4555-8555-555555555555'};
test('legacy sector proposal needs founder approval and revokes target sessions',{skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60_000},async()=>{await withNativeTestPostgres(async databaseUrl=>{const database=createDatabase({databaseUrl,databaseSsl:false});try{
 await migrate(database,await discoverMigrations());
 await database.query(`INSERT INTO users(id,email,password_hash,display_name,role,staff_access_level,staff_sector,email_verified_at) VALUES
  ($1,'legacy@example.test','fixture','Conta legada','admin',2,NULL,now()),
  ($2,'admin4@example.test','fixture','Administrador 4','admin',4,'operations',now()),
  ($3,'founder@example.test','fixture','Fundador','admin',5,'founder',now())`,[ids.target,ids.admin,ids.founder]);
 await assert.rejects(database.query(`INSERT INTO admin_invitations(email,display_name,role,staff_access_level,token_hash,invited_by,expires_at)
  VALUES('incomplete-staff@example.test','Convite incompleto','admin',4,$1,$2,now()+interval '1 day')`,[randomBytes(32),ids.founder]),error=>error.code==='23514');
 await database.query(`INSERT INTO admin_invitations(email,display_name,role,staff_access_level,staff_sector,token_hash,invited_by,expires_at)
  VALUES('complete-staff@example.test','Convite completo','admin',4,'technical',$1,$2,now()+interval '1 day')`,[randomBytes(32),ids.founder]);
 await database.query(`INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 day')`,[ids.target,randomBytes(32)]);
 async function grant(userId,label){const token=(await database.query(`INSERT INTO auth_tokens(user_id,kind,token_hash,expires_at) VALUES($1,'account_step_up',$2,now()+interval '1 hour') RETURNING id`,[userId,randomBytes(32)])).rows[0];return (await database.query(`INSERT INTO account_step_up_requests(user_id,auth_token_id,challenge_hash,purpose,expires_at,confirmed_at) VALUES($1,$2,$3,'staff_access_change',now()+interval '1 hour',now()) RETURNING id`,[userId,token.id,Buffer.from(label)])).rows[0].id;}
 const repository=createStaffAccessRepository(database,{stepUpRepository:createAccountStepUpRepository(database)});
 assert.equal((await repository.listSectors()).unassigned.length,1);
 const proposalGrant=await grant(ids.admin,'proposal');
 const request=await repository.proposeSector({actorId:ids.admin,targetUserId:ids.target,requestedSector:'technical',reason:'Regularização para atuação exclusiva no setor técnico.',grantId:proposalGrant});assert.equal(request.status,'pending');
 assert.equal((await repository.listSectors()).unassigned.length,0);
 const decisionGrant=await grant(ids.founder,'decision'),decided=await repository.decideSector({actorId:ids.founder,requestId:request.id,approved:true,reason:'Enquadramento técnico revisado e autorizado pelo fundador.',grantId:decisionGrant});assert.equal(decided.status,'approved');
 assert.equal((await database.query('SELECT staff_sector FROM users WHERE id=$1',[ids.target])).rows[0].staff_sector,'technical');
 assert.ok((await database.query('SELECT revoked_at FROM sessions WHERE user_id=$1',[ids.target])).rows[0].revoked_at);
 assert.equal((await repository.listSectors()).unassigned.length,0);
}finally{await database.close();}});});
