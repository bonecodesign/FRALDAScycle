import {readJson} from './body.js';
import {sendJson} from './http.js';
import {authenticatedUser} from './session.js';

export async function handleCourierWallet(request,response,{url,headers,requestId,authService,courierWalletService}){
  if(!courierWalletService||!url.pathname.startsWith('/v1/courier/wallet'))return false;
  const user=await authenticatedUser(request,authService);
  const responseHeaders={...headers,'cache-control':'no-store'};
  if(request.method==='GET'&&url.pathname==='/v1/courier/wallet'){
    sendJson(response,200,{wallet:await courierWalletService.summary(user),requestId},responseHeaders);return true;
  }
  if(request.method==='GET'&&url.pathname==='/v1/courier/wallet/activity'){
    sendJson(response,200,{activity:await courierWalletService.activity(user),requestId},responseHeaders);return true;
  }
  if(request.method==='POST'&&url.pathname==='/v1/courier/wallet/withdrawals'){
    const result=await courierWalletService.request(user,await readJson(request));
    sendJson(response,result.reused?200:201,{...result,requestId},responseHeaders);return true;
  }
  return false;
}
