import test from 'node:test';
import assert from 'node:assert/strict';
import { smokeArchitecture } from '../tools/smoke-architecture.mjs';
const env={ADMIN_URL:'https://admin.example.test',API_URL:'https://api.example.test'};
const fetchImpl=async(url,options)=>{
 if(options.headers.cookie)return Response.json({metadata:{revision:'revision-test'},nodes:[],edges:[]},{headers:{'cache-control':'private, no-store'}});
 const page=url.pathname==='/admin/architecture';return new Response('',{status:page?302:401,headers:{'cache-control':'private, no-store',...(page?{location:'/admin/login'}:{})}});
};
test('deployment smoke distinguishes public blocking from authenticated verification',async()=>{
 const anonymous=await smokeArchitecture(env,{fetchImpl});assert.equal(anonymous.publicAccessBlocked,true);assert.equal(anonymous.authenticated,'not-checked');
 const authenticated=await smokeArchitecture({...env,ARCHITECTURE_SESSION_COOKIE:'fc_session=synthetic',ARCHITECTURE_EXPECTED_REVISION:'revision-test'},{fetchImpl});assert.equal(authenticated.authenticated,'pass');
 await assert.rejects(smokeArchitecture({...env,ARCHITECTURE_SESSION_COOKIE:'fc_session=synthetic',ARCHITECTURE_EXPECTED_REVISION:'wrong'},{fetchImpl}),/divergente/);
});
test('deployment smoke detects public exposure and refuses insecure destinations',async()=>{
 await assert.rejects(smokeArchitecture({...env,ADMIN_URL:'http://admin.example.test'},{fetchImpl}),/HTTPS/);
 await assert.rejects(smokeArchitecture(env,{fetchImpl:async()=>new Response('{}')}),/bloqueio inválido/);
});
