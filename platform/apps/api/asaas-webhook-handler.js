import { readSignedJson } from './body.js';
import { sendJson } from './http.js';

export async function handleAsaasWebhook(request,response,{url,headers,requestId,asaasWebhookService}){if(request.method!=='POST'||url.pathname!=='/v1/payments/asaas/webhook')return false;if(!asaasWebhookService){sendJson(response,503,{error:{code:'asaas_not_enabled',message:'Integração Asaas não ativada.'},requestId},headers);return true;}const {raw}=await readSignedJson(request,{limit:65_536});const result=await asaasWebhookService.receive({raw,providedToken:request.headers['asaas-access-token']});sendJson(response,result.duplicate?200:202,{...result,requestId},{...headers,'cache-control':'no-store'});return true;}
