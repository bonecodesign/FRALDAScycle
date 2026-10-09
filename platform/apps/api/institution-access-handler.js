import {readJson} from './body.js';
import {authenticatedUser} from './session.js';
import {sendJson} from './http.js';
export async function handleInstitutionAccess(request,response,{url,headers,requestId,authService,institutionAccessService}){
 if(!institutionAccessService)return false;
 const list=url.pathname==='/v1/institution-access',action=url.pathname.match(/^\/v1\/institution-access\/([0-9a-f-]{36})\/(assign|accept|review)$/i);
 const brands=url.pathname==='/v1/institution-brand-authorizations',brandAuthorize=url.pathname.match(/^\/v1\/institution-brand-authorizations\/([0-9a-f-]{36})\/authorize$/i),brandRevoke=url.pathname.match(/^\/v1\/institution-brand-authorizations\/([0-9a-f-]{36})\/revoke$/i);
 if(!(list&&request.method==='GET'||action&&request.method==='POST'||brands&&request.method==='GET'||brandAuthorize&&request.method==='POST'||brandRevoke&&request.method==='POST'))return false;
 const actor=await authenticatedUser(request,authService);
 let result;
 if(list)result={items:await institutionAccessService.list(actor)};
 else if(action)result={binding:await institutionAccessService[action[2]](actor,action[1],await readJson(request))};
 else if(brands)result={items:await institutionAccessService.brandAuthorizations(actor)};
 else if(brandAuthorize)result={authorization:await institutionAccessService.authorizeBrand(actor,brandAuthorize[1],await readJson(request))};
 else result={authorization:await institutionAccessService.revokeBrand(actor,brandRevoke[1],await readJson(request))};
 const entity=result.binding??result.authorization;sendJson(response,request.method==='POST'&&!entity?.reused?201:200,{...result,requestId},{...headers,'cache-control':'no-store','pragma':'no-cache'});return true;
}
