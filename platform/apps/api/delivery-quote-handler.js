import {readJson} from './body.js';
import {sendJson} from './http.js';
import {authenticatedUser} from './session.js';

export async function handleDeliveryQuotes(request,response,{url,headers,requestId,authService,deliveryQuoteService}){
  if(!deliveryQuoteService)return false;
  const confirm=url.pathname.match(/^\/v1\/delivery-quotes\/([0-9a-f-]{36})\/confirm$/i);
  if(request.method==='POST'&&confirm){
    const actor=await authenticatedUser(request,authService);
    const result=await deliveryQuoteService.confirm(actor.id,{quoteId:confirm[1],...await readJson(request)});
    sendJson(response,result.reused?200:201,{...result,requestId},{...headers,'cache-control':'no-store'});
    return true;
  }
  return false;
}
