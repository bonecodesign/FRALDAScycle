import {readJson} from './body.js';
import {authenticatedUser} from './session.js';
import {sendJson} from './http.js';
export async function handleInstitutionAccess(request,response,{url,headers,requestId,authService,institutionAccessService}){
 if(!institutionAccessService)return false;
 const list=url.pathname==='/v1/institution-access',action=url.pathname.match(/^\/v1\/institution-access\/([0-9a-f-]{36})\/(assign|accept|review)$/i);
 if(!(list&&request.method==='GET'||action&&request.method==='POST'))return false;
 const actor=await authenticatedUser(request,authService);
 const result=list?{items:await institutionAccessService.list(actor)}:{binding:await institutionAccessService[action[2]](actor,action[1],await readJson(request))};
 sendJson(response,request.method==='POST'&&!result.binding.reused?201:200,{...result,requestId},{...headers,'cache-control':'no-store','pragma':'no-cache'});return true;
}
