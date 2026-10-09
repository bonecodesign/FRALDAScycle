import { isMainModule } from '../packages/contracts/main-module.js';

export async function smokeArchitecture(env=process.env,{fetchImpl=fetch}={}){
 if(!env.ADMIN_URL||!env.API_URL)throw new Error('Configure ADMIN_URL e API_URL.');
 const origin=value=>{const u=new URL(value);if(u.username||u.password)throw new Error('Não inclua credenciais no endereço.');if(u.protocol!=='https:'&&!(env.SMOKE_ALLOW_HTTP==='true'&&u.protocol==='http:'))throw new Error('Os destinos devem usar HTTPS.');return u;};
 const admin=origin(env.ADMIN_URL),api=origin(env.API_URL),results=[];
 const request=(base,path,cookie)=>fetchImpl(new URL(path,base),{redirect:'manual',headers:cookie?{cookie}:{},signal:AbortSignal.timeout(10000)});
 async function denied(base,path,expected,name){const r=await request(base,path);if(r.status!==expected)throw new Error(name+': bloqueio inválido (HTTP '+r.status+').');if(!/no-store/.test(r.headers.get('cache-control')||''))throw new Error(name+': cache inadequado.');results.push({name,status:'pass'});return r;}
 const page=await denied(admin,'/admin/architecture',302,'anonymousPage');const location=page.headers.get('location');if(!location||new URL(location,admin).pathname!=='/admin/login')throw new Error('Redirecionamento de login inválido.');
 await denied(admin,'/admin/architecture/data',401,'anonymousData');await denied(admin,'/apps/admin/architecture-network/viewer.js',401,'anonymousAssets');await denied(api,'/v1/admin/architecture',401,'anonymousApi');
 let authenticated='not-checked';
 if(env.ARCHITECTURE_SESSION_COOKIE){
  const res=await request(admin,'/admin/architecture/data',env.ARCHITECTURE_SESSION_COOKIE);if(res.status!==200)throw new Error('A sessão administrativa não carregou o mapa.');if(!/private.*no-store/.test(res.headers.get('cache-control')||''))throw new Error('O mapa não deve usar cache público.');
  const graph=await res.json();if(!graph.metadata?.revision||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges))throw new Error('Contrato do mapa inválido.');if(env.ARCHITECTURE_EXPECTED_REVISION&&graph.metadata.revision!==env.ARCHITECTURE_EXPECTED_REVISION)throw new Error('Mapa divergente da versão implantada.');
  results.push({name:'authenticatedMap',status:'pass'});authenticated='pass';
 }
 return {publicAccessBlocked:true,authenticated,checkedAt:new Date().toISOString(),results};
}
if(isMainModule(import.meta.url))smokeArchitecture().then(r=>console.log(JSON.stringify(r,null,2))).catch(()=>{console.error(JSON.stringify({publicAccessBlocked:false,error:'Verificação incompleta. Confirme os destinos, a sessão e os bloqueios de acesso.'}));process.exitCode=1;});
