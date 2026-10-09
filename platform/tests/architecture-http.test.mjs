import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createApiServer } from '../apps/api/server.js';
import { loadConfig } from '../apps/api/config.js';

async function surface(context,name,apiOrigin){
 const reservation=createServer();await new Promise((resolve,reject)=>{reservation.once('error',reject);reservation.listen(0,'127.0.0.1',resolve);});const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const child=spawn(process.execPath,['tools/dev-server.mjs',name,String(port)],{cwd:new URL('..',import.meta.url),env:{...process.env,NODE_ENV:'production',SURFACE_HOST:'127.0.0.1',ADMIN_SESSION_API_ORIGIN:apiOrigin},stdio:['ignore','pipe','pipe']});context.after(()=>child.kill());
 await new Promise((resolve,reject)=>{let stderr='';const timer=setTimeout(()=>reject(new Error('surface startup timeout')),5000);child.stderr.on('data',b=>stderr+=b);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);reject(new Error('surface exited '+code+': '+stderr));});child.stdout.once('data',()=>{clearTimeout(timer);resolve();});});return 'http://127.0.0.1:'+port;
}

test('real HTTP integration: ADM login, private map/assets, public denial and session revocation',async context=>{
 const sessions=new Map([['admin-session',{id:'synthetic-admin',role:'admin'}],['moderator-session',{id:'synthetic-moderator',role:'moderator'}],['customer-session',{id:'synthetic-customer',role:'customer'}]]);
 const graph={nodes:[{id:'root',kind:'root',label:'Private architecture fixture',files:[]}],edges:[],areas:[],stats:{files:0,sectors:0,imports:0},metadata:{revision:'synthetic-revision',generatedAt:new Date().toISOString(),mode:'snapshot'}};
 const api=createApiServer({config:loadConfig({NODE_ENV:'test'}),authService:{async session(token){return sessions.get(token)||null;},async login(){return {user:sessions.get('admin-session'),token:'admin-session',expiresAt:new Date(Date.now()+3600000).toISOString()};},async logout(token){sessions.delete(token);}},architectureService:{async graph(){return graph;}}});
 await new Promise((resolve,reject)=>{api.once('error',reject);api.listen(0,'127.0.0.1',resolve);});context.after(()=>api.close());
 const apiOrigin='http://127.0.0.1:'+api.address().port,admin=await surface(context,'admin',apiOrigin),site=await surface(context,'site',apiOrigin);
 const get=(base,path,role)=>fetch(base+path,{redirect:'manual',headers:role?{cookie:'fc_session='+role+'-session'}:{}});
 const anonymous=await get(admin,'/admin/architecture');assert.equal(anonymous.status,302);assert.equal(anonymous.headers.get('location'),'/admin/login');
 for(const path of ['/admin/architecture/data','/apps/admin/architecture-network/viewer.js','/apps//admin/architecture-network/controller.js']){assert.equal((await get(admin,path)).status,401);assert.equal((await get(admin,path,'moderator')).status,403);assert.equal((await get(admin,path,'customer')).status,403);}
 assert.equal((await get(site,'/admin/architecture/data','admin')).status,404);assert.equal((await get(site,'/apps/admin/architecture.html','admin')).status,404);assert.equal((await get(admin,'/apps/api/private/architecture-network.json','admin')).status,404);
 const login=await fetch(admin+'/admin/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'synthetic@example.test',password:'synthetic-password'})});assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/fc_session=admin-session.*HttpOnly/);
 const page=await get(admin,'/admin/architecture','admin');assert.equal(page.status,200);assert.match(await page.text(),/Arquitetura Neural/);assert.match(page.headers.get('cache-control'),/private.*no-store/);
 const data=await get(admin,'/admin/architecture/data','admin');assert.equal(data.status,200);assert.deepEqual(await data.json(),graph);
 const assets=await get(admin,'/apps/admin/architecture-network/viewer.js','admin');assert.equal(assets.status,200);assert.match(assets.headers.get('cache-control'),/private.*no-store/);
 assert.equal((await get(apiOrigin,'/v1/admin/architecture')).status,401);assert.equal((await get(apiOrigin,'/v1/admin/architecture','moderator')).status,403);
 const logout=await fetch(admin+'/admin/auth/logout',{method:'POST',headers:{'content-type':'application/json',cookie:'fc_session=admin-session'},body:'{}'});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);assert.equal((await get(admin,'/admin/architecture/data','admin')).status,401);
});
