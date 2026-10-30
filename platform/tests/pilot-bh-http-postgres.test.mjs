import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {createAuthService} from '../apps/api/auth-service.js';
import {loadConfig} from '../apps/api/config.js';
import {createPilotInvitationService} from '../apps/api/pilot-invitation-service.js';
import {createDatabase} from '../database/client.js';
import {createAuthRepository} from '../database/auth-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {createPilotInvitationRepository} from '../database/pilot-invitation-repository.js';
import {createLogisticsRepository} from '../database/logistics-repository.js';
import {createLogisticsService} from '../apps/api/logistics-service.js';

const databaseUrl=process.env.FC_LISTING_TEST_DATABASE_URL;
const admin={id:'10000000-0000-4000-8000-000000000099',role:'admin'};

test('BH pilot issues, consumes and revokes one-time invitations across HTTP and PostgreSQL',{
  skip:!databaseUrl?'Banco temporário de validação não configurado.':false,
  timeout:60000,
},async()=>{
  const url=new URL(databaseUrl);
  assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
  const database=createDatabase({databaseUrl,databaseSsl:false});let server;
  try{
    await migrate(database,await discoverMigrations());
    await database.query(`INSERT INTO users(id,email,password_hash,display_name,role,email_verified_at,adult_declared_at,adult_declaration_version)
      VALUES($1,'pilot-admin@example.test','fixture','Admin fictício','admin',now(),now(),'FC-AGE-1')`,[admin.id]);
    const config=loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000',PILOT_BH_ENABLED:'true',PILOT_BH_INVITED_EMAILS:'bootstrap@example.test'});
    const realAuth=createAuthService(createAuthRepository(database),{pilotBh:config.pilotBh});
    const authService={...realAuth,async session(token){return token==='admin'?admin:realAuth.session(token);}};
    const invitationService=createPilotInvitationService(createPilotInvitationRepository(database),{
      clock:()=>Date.parse('2030-01-01T12:00:00Z'),
      tokenFactory:(()=>{let suffix=0;return()=>String.fromCharCode(97+suffix++).repeat(43);})(),
    });
    const logisticsService=createLogisticsService(createLogisticsRepository(database,{pilotBh:config.pilotBh}),null,null,{pilotBh:config.pilotBh});
    server=createApiServer({config,authService,pilotInvitationService:invitationService,logisticsService});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin=`http://127.0.0.1:${server.address().port}`;
    const request=(path,{actor=null,body=null,method=body?'POST':'GET'}={})=>fetch(origin+path,{method,headers:{...(actor?{cookie:`fc_session=${actor}`}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const issueBody=email=>({email,purpose:'Acesso sintético controlado ao piloto BH.',expiresAt:'2030-01-08T12:00:00Z',requestReference:`pilot-http-${email.replace(/[^a-z0-9.-]/gi,'-')}`});

    const issue=await request('/v1/admin/pilot-invitations',{actor:'admin',body:issueBody('convidada@example.test')});
    assert.equal(issue.status,201);const issued=await issue.json();assert.match(issued.token,/^[A-Za-z0-9_-]{43}$/);assert.equal(issued.delivered,false);
    const replay=await request('/v1/admin/pilot-invitations',{actor:'admin',body:issueBody('convidada@example.test')});
    assert.equal(replay.status,200);assert.equal((await replay.json()).token,null);

    const registration={email:'convidada@example.test',displayName:'Pessoa Convidada',password:'frase-segura-sintetica-2030',adultConfirmed:true,adultDeclarationVersion:'FC-AGE-1',pilotInvitationToken:issued.token};
    const registered=await request('/v1/auth/register',{body:registration});assert.equal(registered.status,201,await registered.text());
    const stored=(await database.query(`SELECT p.consumed_at,p.consumed_by,u.email
      FROM pilot_invitations p JOIN users u ON u.id=p.consumed_by WHERE p.email=$1`,[registration.email])).rows[0];
    assert.ok(stored.consumed_at);assert.equal(stored.email,registration.email);
    await database.query('UPDATE users SET email_verified_at=now() WHERE email=$1',[registration.email]);
    const login=await request('/v1/auth/login',{body:{email:registration.email,password:registration.password}});assert.equal(login.status,200,await login.text());
    const sessionToken=/fc_session=([^;]+)/.exec(login.headers.get('set-cookie')??'')?.[1];
    assert.match(sessionToken,/^[A-Za-z0-9_-]{43}$/);
    const insideAddress={label:'Destino sintético BH',postalCode:'30110-028',street:'Avenida Afonso Pena',number:'1000',district:'Centro',city:'Belo Horizonte',state:'MG'};
    const createdAddress=await request('/v1/addresses',{actor:sessionToken,body:insideAddress});const createdAddressBody=await createdAddress.json();
    assert.equal(createdAddress.status,201,JSON.stringify(createdAddressBody));assert.equal(createdAddressBody.address.postal_code,'30110028');
    const listedAddresses=await request('/v1/addresses',{actor:sessionToken});assert.equal(listedAddresses.status,200);assert.equal((await listedAddresses.json()).items.length,1);
    const outsideAddress=await request('/v1/addresses',{actor:sessionToken,body:{...insideAddress,label:'Destino recusado',postalCode:'32000-000'}});
    assert.equal(outsideAddress.status,403);assert.equal((await outsideAddress.json()).error.code,'pilot_outside_bh');
    assert.equal((await database.query('SELECT count(*)::int AS count FROM addresses WHERE user_id=$1',[stored.consumed_by])).rows[0].count,1);
    const reused=await request('/v1/auth/register',{body:{...registration,email:'outra@example.test'}});
    assert.equal(reused.status,403);assert.equal((await reused.json()).error.code,'pilot_invitation_required');

    const second=await request('/v1/admin/pilot-invitations',{actor:'admin',body:issueBody('revogada@example.test')});
    const secondBody=await second.json();assert.equal(second.status,201);
    const revoked=await request(`/v1/admin/pilot-invitations/${secondBody.invitation.id}/revoke`,{actor:'admin',body:{reason:'Convite revogado no teste sintético integrado.'}});
    assert.equal(revoked.status,200);
    const revokedRegistration=await request('/v1/auth/register',{body:{...registration,email:'revogada@example.test',pilotInvitationToken:secondBody.token}});
    assert.equal(revokedRegistration.status,403);assert.equal((await revokedRegistration.json()).error.code,'pilot_invitation_required');
    assert.equal((await database.query("SELECT count(*)::int AS count FROM users WHERE email IN('outra@example.test','revogada@example.test')")).rows[0].count,0);
  }finally{if(server?.listening)await new Promise(resolve=>server.close(resolve));await database.close();}
});
