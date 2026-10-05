import {readJson} from './body.js';
import {authenticatedUser} from './session.js';
import {sendJson} from './http.js';
export async function handlePrivacyRequests(request,response,{url,headers,requestId,authService,privacyRequestService}){
  if(!privacyRequestService)return false;
  const match=url.pathname.match(/^\/v1\/privacy-requests(?:\/([0-9a-f-]{36})(\/assessment)?)?$/i);
  if(!match||!['GET','POST'].includes(request.method)||request.method==='GET'&&match[2]||request.method==='POST'&&match[1]&&!match[2])return false;
  const actor=await authenticatedUser(request,authService);
  const result=request.method==='GET'?(match[1]?{request:await privacyRequestService.detail(actor,match[1])}:{items:await privacyRequestService.list(actor)}):
    {request:match[2]?await privacyRequestService.assess(actor,match[1],await readJson(request)):await privacyRequestService.create(actor,await readJson(request))};
  sendJson(response,request.method==='POST'&&!result.request.reused?201:200,{...result,requestId},{...headers,'cache-control':'no-store','pragma':'no-cache'});return true;
}
