import {readSignedJson} from './body.js';
import {sendJson} from './http.js';

export async function handleWalletPayoutWebhook(request,response,{url,headers,requestId,service}){
  if(request.method!=='POST'||url.pathname!=='/v1/courier/wallet/payouts/webhook')return false;
  if(!service){sendJson(response,503,{error:{code:'wallet_payout_webhook_not_configured',message:'Webhook de saques indisponível.'},requestId},headers);return true;}
  const{raw}=await readSignedJson(request,{limit:32_768});
  const result=await service.receive({raw,timestamp:request.headers['x-wallet-payout-timestamp'],signature:request.headers['x-wallet-payout-signature']});
  sendJson(response,200,{status:result.withdrawal.status,reused:result.reused,requestId},{...headers,'cache-control':'no-store'});return true;
}
