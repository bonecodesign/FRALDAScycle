import {readJson} from './body.js';
import {authenticatedUser} from './session.js';
import {sendJson} from './http.js';
export async function handleExchanges(request,response,{url,headers,requestId,authService,exchangeService,childProfileService}){
 if(!exchangeService)return false;const root=url.pathname==='/v1/exchanges',route=url.pathname.match(/^\/v1\/exchanges\/([0-9a-f-]{36})(?:\/(accept|refuse|cancel|complete))?$/i);
 if(!(root&&request.method==='POST'||route&&request.method==='GET'&&!route[2]||route&&request.method==='POST'&&route[2]))return false;
 const actor=await authenticatedUser(request,authService);let result,status=200;
 if(root){await childProfileService?.requireForNewOperation(actor);result={exchange:await exchangeService.propose(actor,await readJson(request))};status=201;}
 else if(request.method==='GET')result={exchange:await exchangeService.detail(actor,route[1])};
 else {const exchange=await exchangeService[route[2]](actor,route[1],await readJson(request));result={exchange};status=exchange.reused?200:201;}
 sendJson(response,status,{...result,requestId},{...headers,'cache-control':'no-store'});return true;
}
