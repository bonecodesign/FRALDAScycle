import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleArchitecture } from '../apps/api/architecture-handler.js';
import { createArchitectureService } from '../apps/api/architecture-service.js';
import { buildArchitectureGraph, writeArchitectureSnapshot } from '../tools/architecture-network.mjs';
import { handleArchitectureAccess } from '../tools/admin-architecture-access.mjs';
import { isPrivateArchitectureFile } from '../tools/architecture-public-access.mjs';

function response(){return {status:null,headers:{},body:'',writeHead(status,headers){this.status=status;this.headers=headers;},end(body=''){this.body=body;}};}
const req=(cookie,method='GET')=>({method,headers:{cookie:cookie?`fc_session=${cookie}`:''}});
const actor={async session(token){return ['admin','moderator','customer','courier'].includes(token)?{id:'test-user',role:token}:null;}};

test('architecture API rejects anonymous and non-admin sessions before reading graph; admin gets no-store data',async()=>{
 let reads=0;const graph={nodes:[{id:'private-module'}],edges:[],metadata:{revision:'test'}};
 for(const [role,expected]of [[null,401],['customer',403],['courier',403],['moderator',403],['admin',200]]){
  const res=response();const options={url:new URL('http://test/v1/admin/architecture'),headers:{},requestId:'test',authService:actor,architectureService:{async graph(){reads++;return graph;}}};
  if(expected===200){assert.equal(await handleArchitecture(req(role),res,options),true);assert.equal(res.status,200);assert.match(res.headers['cache-control'],/private.*no-store/);assert.match(res.headers.vary,/Cookie/);assert.deepEqual(JSON.parse(res.body),graph);}else await assert.rejects(handleArchitecture(req(role),res,options),error=>error.status===expected);
 }
 assert.equal(reads,1);
});

test('admin surface protects page aliases, assets and data even in local demonstration mode',async()=>{
 for(const production of [false,true])for(const pathname of ['/admin/architecture','/apps/admin/architecture.html','/apps//admin/architecture.html','/apps/admin/architecture-network/viewer.js','/admin/architecture/data'])for(const role of [null,'customer','moderator','admin']){
  const res=response();const handled=await handleArchitectureAccess(req(role),res,{pathname,surface:'admin',production,apiOrigin:'http://internal-api:4200',fetchImpl:async(url,options)=>{
   assert.equal(options.headers.cookie,req(role).headers.cookie);
   if(url.pathname==='/v1/auth/session')return new Response(JSON.stringify(role?{user:{role}}:{error:{code:'unauthenticated'}}),{status:role?200:401});
   assert.equal(url.pathname,'/v1/admin/architecture');assert.equal(role,'admin');return new Response(JSON.stringify({nodes:[{id:'secret'}]}));
  }});
  if(role==='admin'&&pathname!=='/admin/architecture/data')assert.equal(handled,false);
  else{assert.equal(handled,true);const html=pathname==='/admin/architecture'||pathname.endsWith('.html');assert.equal(res.status,role==='admin'?200:role?403:html?302:401);assert.match(res.headers['cache-control'],/no-store/);if(role!=='admin')assert.ok(!res.body.includes('secret'));}
 }
});

test('site/app cannot fetch architecture; unavailable authentication fails closed; old exports are blocked',async()=>{
 for(const surface of ['site','app']){const res=response();assert.equal(await handleArchitectureAccess(req('admin'),res,{pathname:'/apps/admin/architecture-network/viewer.js',surface}),true);assert.equal(res.status,404);}
 for(const options of [{production:true},{production:false,fetchImpl:async()=>{throw new Error('offline');}},{production:true,apiOrigin:'http://api',fetchImpl:async()=>new Response('{}',{status:503})}]){const res=response();assert.equal(await handleArchitectureAccess(req('admin'),res,{pathname:'/admin/architecture',surface:'admin',...options}),true);assert.equal(res.status,503);}
 const root='/sample/project';assert.equal(isPrivateArchitectureFile(root,root+'/architecture/viewer/fraldacycle-rede-zoom.html'),true);assert.equal(isPrivateArchitectureFile(root,root+'/platform/apps/api/private/architecture-network.json'),true);assert.equal(isPrivateArchitectureFile(root,root+'/assets/logo.svg'),false);
});

test('local graph synchronizes additions, imports and removals with new revision; production uses packaged snapshot',async context=>{
 const root=await mkdtemp(join(tmpdir(),'fc-architecture-'));context.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'platform/apps/api'),{recursive:true});await mkdir(join(root,'platform/database'),{recursive:true});
 await writeFile(join(root,'platform/apps/api/marketplace-service.js'),"import { database } from '../../database/client.js';\n");await writeFile(join(root,'platform/database/client.js'),'export const database = {};');
 const service=createArchitectureService({mode:'repository',root});const first=await service.graph();assert.equal(first.stats.files,2);assert.equal(first.stats.imports,1);assert.equal((await service.graph()).metadata.generatedAt,first.metadata.generatedAt);
 await writeFile(join(root,'platform/apps/api/payment-service.js'),'export const payment = {};');const next=await service.graph();assert.notEqual(next.metadata.revision,first.metadata.revision);assert.equal(next.stats.files,3);
 await rm(join(root,'platform/apps/api/payment-service.js'));assert.equal((await service.graph()).stats.files,2);
 const snapshot=join(root,'platform/apps/api/private/architecture-network.json');await writeArchitectureSnapshot(root,snapshot);const production=createArchitectureService({mode:'snapshot',root,snapshot});const packaged=await production.graph();assert.equal(packaged.metadata.mode,'snapshot');assert.equal(packaged.stats.files,2);assert.equal((await buildArchitectureGraph(root)).metadata.revision,first.metadata.revision);
 const ids=new Set(packaged.nodes.map(n=>n.id));for(const edge of packaged.edges)assert.ok(ids.has(edge.source)&&ids.has(edge.target));
});

test('admin page contains no embedded architecture inventory and menu is restricted to admin role',async()=>{
 const page=await readFile(new URL('../apps/admin/architecture.html',import.meta.url),'utf8');assert.match(page,/Arquitetura Neural/);assert.match(page,/id="architecture-view"[^>]*hidden/);assert.doesNotMatch(page,/const NETWORK|network-data\.js|file:platform|417 imports/);
 const auth=await readFile(new URL('../apps/admin/auth.js',import.meta.url),'utf8');const roles=auth.match(/const ROLE_NAVIGATION = \{([\s\S]*?)\n\};/)[1];assert.match(roles.match(/admin: \[([^\]]+)\]/)[1],/"architecture"/);assert.doesNotMatch(roles.match(/moderator: \[([^\]]+)\]/)[1],/"architecture"/);
});

test('ADM synchronization retries initial outage, updates a changed revision and hides the graph on revoked access',async()=>{
 const {runInNewContext}=await import('node:vm');const elements=new Map();let intervalCalls=0,updates=0,mounts=0;
 function element(id){if(!elements.has(id))elements.set(id,{id,innerHTML:'private',textContent:'',handlers:{},append(){},addEventListener(type,fn){this.handlers[type]=fn;}});return elements.get(id);}
 const replies=[new Response('{}',{status:503}),new Response(JSON.stringify({nodes:[],edges:[],metadata:{revision:'a',mode:'repository',generatedAt:new Date().toISOString()}})),new Response(JSON.stringify({nodes:[],edges:[],metadata:{revision:'b',mode:'repository',generatedAt:new Date().toISOString()}})),new Response('{}',{status:403})];
 const sandbox={document:{hidden:false,getElementById:element,createElement:()=>element('login-link'),addEventListener(){}},window:{addEventListener(){}},fetch:async()=>replies.shift(),AbortSignal,Date,setInterval(){intervalCalls++;return 1;},clearInterval(){},mountArchitecture(){mounts++;return {update(){updates++;}};}};
 const source=(await readFile(new URL('../apps/admin/architecture-network/controller.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
 await runInNewContext('(async()=>{'+source+'})()',sandbox);
 assert.equal(element('architecture-view').hidden,true);assert.equal(element('architecture-retry').hidden,false);
 await element('architecture-retry').handlers.click();assert.equal(mounts,1);assert.equal(intervalCalls,1);assert.equal(element('architecture-view').hidden,false);
 await element('architecture-refresh').handlers.click();assert.equal(updates,1);assert.match(element('architecture-sync-status').textContent,/revisão b/);
 await element('architecture-refresh').handlers.click();assert.equal(element('architecture-view').hidden,true);assert.equal(element('graph').innerHTML,'');assert.match(element('architecture-access-state').textContent,/exclusivo/);
});

test('ADM same-origin authentication forwards the HttpOnly cookie for the protected architecture',async()=>{
 const {handleAdminSessionProxy}=await import('../tools/admin-session-proxy.mjs');
 const request={method:'POST',headers:{'content-type':'application/json'},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify({email:'synthetic@example.test',password:'synthetic-password'}));}};
 const res=response();assert.equal(await handleAdminSessionProxy(request,res,{pathname:'/admin/auth/login',surface:'admin',production:true,apiOrigin:'http://internal-api:4200',fetchImpl:async(url,options)=>{
  assert.equal(url.pathname,'/v1/auth/login');assert.equal(options.method,'POST');assert.equal(JSON.parse(options.body).email,'synthetic@example.test');return new Response(JSON.stringify({user:{role:'admin'}}),{headers:{'set-cookie':'fc_session=synthetic; HttpOnly; Secure; SameSite=Lax; Path=/'}});
 }}),true);assert.equal(res.status,200);assert.match(res.headers['set-cookie'][0],/HttpOnly/);assert.match(res.headers['cache-control'],/no-store/);
 const publicResponse=response();assert.equal(await handleAdminSessionProxy(request,publicResponse,{pathname:'/admin/auth/login',surface:'site'}),true);assert.equal(publicResponse.status,404);
});

test('integrated renderer keeps zoom and selection while applying a new graph revision',async()=>{
 const {runInNewContext}=await import('node:vm');const elements=new Map();
 function element(id){if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',value:'',dataset:{},handlers:{},children:[],setAttribute(k,v){this[k]=v;},append(x){this.children.push(x);},addEventListener(k,v){this.handlers[k]=v;}});return elements.get(id);}
 const graph={nodes:[{id:'root',kind:'root',area:null,label:'FraldaCycle',files:[],description:'Projeto'},{id:'area:test',kind:'area',area:'test',label:'Área',files:[],description:'Área de teste'}],edges:[{source:'root',target:'area:test',type:'structure'}],areas:[{id:'test',label:'Área',color:'#75cdb8'}],stats:{files:0,sectors:0,imports:0},scope:'teste'};
 const code=(await readFile(new URL('../apps/admin/architecture-network/viewer.js',import.meta.url),'utf8')).replace('export function','function');const sandbox={graph,document:{getElementById:element,createElement:()=>({setAttribute(){},append(){}})},requestAnimationFrame:f=>f(),Date,console};
 const view=runInNewContext(code+'\nmountArchitecture(graph)',sandbox);element('zoom-range').oninput({target:{value:'1200'}});element('graph').handlers.click({target:{closest:()=>({dataset:{node:'area:test'}})}});assert.equal(element('title').textContent,'Área');
 const next=structuredClone(graph);next.nodes[1].label='Área atualizada';view.update(next);assert.equal(element('title').textContent,'Área atualizada');assert.equal(element('zoom-value').textContent,'1200%');assert.match(element('selected-chip').textContent,/Área atualizada/);
 // Desktop wheel keeps the world point beneath the cursor fixed, including SVG letterboxing.
 const svg=element('graph');svg.getBoundingClientRect=()=>({left:10,top:20,width:1100,height:900});
 element('reset').onclick();svg.handlers.wheel({preventDefault(){},clientX:810,clientY:490,deltaY:-Math.log(2)*1000});
 assert.equal(element('zoom-value').textContent,'200%');
 const rootX=()=>Number(svg.innerHTML.match(/data-node="root"[^>]*><circle cx="([^"]+)"/)[1]);
 assert.equal(rootX(),300);
 const rotation=element('ry').value;
 svg.handlers.keydown({key:'ArrowRight',shiftKey:true,preventDefault(){}});assert.equal(rootX(),335);assert.equal(element('ry').value,rotation);
 svg.handlers.pointerdown({pointerId:1,button:0,shiftKey:true,clientX:100,clientY:100});
 svg.handlers.pointermove({pointerId:1,clientX:160,clientY:100});assert.equal(rootX(),395);assert.equal(element('ry').value,rotation);
 svg.handlers.pointercancel({pointerId:1});view.update(next);assert.equal(rootX(),395);assert.equal(element('zoom-value').textContent,'200%');
 svg.handlers.keydown({key:'Home',preventDefault(){}});assert.equal(rootX(),550);assert.equal(element('zoom-value').textContent,'100%');

});

test('API request pipeline dispatches the architecture route and enforces admin permission without exposing a static snapshot',async()=>{
 const {EventEmitter}=await import('node:events');const {createApiServer}=await import('../apps/api/server.js');const {loadConfig}=await import('../apps/api/config.js');
 const server=createApiServer({config:loadConfig({NODE_ENV:'test'}),authService:actor,architectureService:{async graph(){return {metadata:{revision:'private'},nodes:[],edges:[]};}},rateLimiter:{async consume(){return {allowed:true,limit:100,remaining:99,resetAt:Date.now()+60000};}},telemetry:{async record(){}}});
 const listener=server.listeners('request')[0];
 for(const[role,status]of [[null,401],['moderator',403],['admin',200]]){
  const res=new EventEmitter();res.headers={};res.writeHead=(code,headers)=>{res.statusCode=code;res.headers=headers;};res.end=body=>{res.body=body;res.emit('finish');};
  await listener({...req(role),url:'/v1/admin/architecture',socket:{remoteAddress:'127.0.0.1'}},res);
  assert.equal(res.statusCode,status);if(role==='admin')assert.equal(JSON.parse(res.body).metadata.revision,'private');else assert.ok(!res.body.includes('private'));
 }
});
