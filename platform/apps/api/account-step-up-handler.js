import { readJson } from './body.js';
import { sendJson } from './http.js';
import { authenticatedUser } from './session.js';

export async function handleAccountStepUp(request,response,{url,headers,requestId,authService,accountStepUpService}){if(!accountStepUpService)return false;const action=request.method==='POST'&&url.pathname==='/v1/account/step-up/request'?'request':request.method==='POST'&&url.pathname==='/v1/account/step-up/confirm'?'confirm':null;if(!action)return false;const actor=await authenticatedUser(request,authService);const result=await accountStepUpService[action](actor,await readJson(request));sendJson(response,action==='request'?202:200,{...result,requestId},{...headers,'cache-control':'no-store',pragma:'no-cache'});return true;}
