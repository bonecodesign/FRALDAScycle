import {readJson} from './body.js';
import {authenticatedUser} from './session.js';
import {sendJson} from './http.js';
export async function handleAddressChanges(request,response,{url,headers,requestId,authService,addressChangeService}){
  if(!addressChangeService)return false;
  const match=url.pathname.match(/^\/v1\/address-change-requests(?:\/([0-9a-f-]{36})(\/review)?)?$/i);
  if(!match||!['GET','POST'].includes(request.method))return false;
  if(request.method==='POST'&&match[1]&&!match[2]||request.method==='GET'&&match[2])return false;
  const actor=await authenticatedUser(request,authService);
  const result=request.method==='GET'?(match[1]?{request:await addressChangeService.detail(actor,match[1])}:{items:await addressChangeService.list(actor)}):
    {request:match[2]?await addressChangeService.review(actor,match[1],await readJson(request)):await addressChangeService.request(actor,await readJson(request))};
  sendJson(response,request.method==='POST'&&!result.request.reused?201:200,{...result,requestId},{...headers,'cache-control':'no-store','pragma':'no-cache'});return true;
}
