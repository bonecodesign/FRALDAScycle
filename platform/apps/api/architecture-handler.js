import { authenticatedUser } from './session.js';
import { requireScope } from './authorization.js';
import { sendJson } from './http.js';

export async function handleArchitecture(request,response,{url,headers,requestId,authService,architectureService}) {
 if(url.pathname!=='/v1/admin/architecture'||request.method!=='GET')return false;
 const user=await authenticatedUser(request,authService,{optionalService:true});
 requireScope(user,'admin:architecture:read');
 const graph=await architectureService.graph();
 sendJson(response,200,graph,{...headers,'cache-control':'private, no-store','vary':'Origin, Cookie'});
 return true;
}
