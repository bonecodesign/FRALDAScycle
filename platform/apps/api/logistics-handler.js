import { readJson } from "./body.js";
import { readSessionCookie } from "./cookies.js";
import { AuthError } from "./auth-service.js";
import { sendJson } from "./http.js";
async function user(request,authService){const value=await authService.session(readSessionCookie(request.headers.cookie));if(!value)throw new AuthError("unauthenticated",401,"Sessão não autenticada.");return value}
export async function handleLogistics(request,response,{url,headers,requestId,authService,logisticsService}){
  if(!logisticsService)return false;
  if(request.method==="POST"&&url.pathname==="/v1/shipments"){
    const actor=await user(request,authService);const result=await logisticsService.create(actor.id,await readJson(request));
    sendJson(response,result.reused?200:201,{...result,requestId},headers);return true;
  }
  const detail=url.pathname.match(/^\/v1\/shipments\/([0-9a-f-]{36})$/i);
  if(request.method==="GET"&&detail){const actor=await user(request,authService);const shipment=await logisticsService.detail(actor.id,detail[1]);sendJson(response,200,{shipment,requestId},headers);return true}
  const assign=url.pathname.match(/^\/v1\/shipments\/([0-9a-f-]{36})\/assign$/i);
  if(request.method==="POST"&&assign){const actor=await user(request,authService);if(actor.role!=="courier"&&actor.role!=="admin")throw new AuthError("forbidden",403,"Acesso não autorizado.");const shipment=await logisticsService.assign(actor.id,assign[1]);sendJson(response,200,{shipment,requestId},headers);return true}
  const proof=url.pathname.match(/^\/v1\/shipments\/([0-9a-f-]{36})\/proof$/i);
  if(request.method==="POST"&&proof){const actor=await user(request,authService);if(actor.role!=="courier"&&actor.role!=="admin")throw new AuthError("forbidden",403,"Acesso não autorizado.");const result=await logisticsService.proof(actor.id,proof[1],await readJson(request));sendJson(response,201,{proof:result,requestId},headers);return true}
  return false;
}
