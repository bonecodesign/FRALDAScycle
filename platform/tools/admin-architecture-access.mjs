import { posix } from 'node:path';
const protectedPath=raw=>{const path=posix.normalize(raw);return path==='/admin/architecture'||path==='/admin/architecture/'||path.startsWith('/admin/architecture/')||path==='/apps/admin/architecture.html'||path.startsWith('/apps/admin/architecture-network/');};
export function isArchitecturePath(path){return protectedPath(path);}
function json(response,status,error){response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff','vary':'Cookie'});response.end(JSON.stringify({error}));}
export async function handleArchitectureAccess(request,response,{pathname,surface,production,apiOrigin,fetchImpl=fetch}){
 pathname=posix.normalize(pathname);
 if(!protectedPath(pathname))return false;
 if(surface!=='admin'){json(response,404,{code:'route_not_found',message:'Não encontrado.'});return true;}
 if(request.method!=='GET'){json(response,405,{code:'method_not_allowed',message:'Método não permitido.'});return true;}
 const origin=apiOrigin||(!production?'http://127.0.0.1:4200':null);
 if(!origin){json(response,503,{code:'admin_api_unavailable',message:'Autenticação administrativa indisponível.'});return true;}
 try{
  const target=new URL(origin);if(!['http:','https:'].includes(target.protocol)||target.username||target.password)throw new Error('invalid server configuration');
  const headers={cookie:request.headers.cookie||''};
  const session=await fetchImpl(new URL('/v1/auth/session',target),{headers,redirect:'error',signal:AbortSignal.timeout(5000)});
  const payload=await session.json();
  if(!session.ok||!payload.user){
   if(session.status!==401&&session.status!==403&&session.status!==200)throw new Error('authentication unavailable');
   const html=pathname==='/admin/architecture'||pathname==='/admin/architecture/'||pathname==='/apps/admin/architecture.html';
   if(html){response.writeHead(302,{location:'/admin/login','cache-control':'private, no-store','vary':'Cookie'});response.end();}else json(response,401,{code:'unauthenticated',message:'Entre no painel administrativo.'});
   return true;
  }
  if(payload.user.role!=='admin'){json(response,403,{code:'forbidden',message:'Somente administradores podem acessar a Arquitetura Neural.'});return true;}
  if(pathname==='/admin/architecture/data'){
   const result=await fetchImpl(new URL('/v1/admin/architecture',target),{headers,redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!result.ok){json(response,result.status,{code:'architecture_unavailable',message:'Não foi possível carregar a arquitetura.'});return true;}
   const graph=await result.json();
   response.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff','vary':'Cookie'});response.end(JSON.stringify(graph));return true;
  }
  return false;
 }catch{json(response,503,{code:'admin_api_unavailable',message:'Não foi possível verificar a sessão administrativa.'});return true;}
}
