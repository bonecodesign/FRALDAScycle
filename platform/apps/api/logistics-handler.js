import { readJson, readSignedJson } from "./body.js";
import { authenticatedUser } from "./session.js";
import { AuthError } from "./auth-service.js";
import { sendJson } from "./http.js";
export async function handleLogistics(request,response,{url,headers,requestId,authService,logisticsService,logisticsProvider}){
  if(request.method==="POST"&&url.pathname==="/v1/logistics/webhooks"){
    if(!logisticsService||!logisticsProvider)return false;
    const {raw}=await readSignedJson(request,{limit:65536});
    const event=logisticsProvider.verifyWebhook({raw,timestamp:request.headers["x-logistics-timestamp"],signature:request.headers["x-logistics-signature"]});
    const result=await logisticsService.processWebhook(event);sendJson(response,200,{...result,requestId},headers);return true;
  }
  if(!logisticsService)return false;
  if(request.method==='GET'&&['/v1/courier/shipments','/v1/courier/history'].includes(url.pathname)){
    const actor=await authenticatedUser(request,authService);
    const items=url.pathname==='/v1/courier/history'?await logisticsService.courierHistory(actor):await logisticsService.courierShipments(actor);
    sendJson(response,200,{items,requestId},{...headers,'cache-control':'no-store'});return true;
  }
  if(url.pathname==="/v1/addresses"&&["GET","POST"].includes(request.method)){
    const actor=await authenticatedUser(request,authService);
    const result=request.method==="GET"?{items:await logisticsService.ownAddresses(actor.id)}:
      {address:await logisticsService.createAddress(actor.id,await readJson(request))};
    sendJson(response,request.method==="POST"?201:200,{...result,requestId},{...headers,"cache-control":"no-store"});return true;
  }
  const address=url.pathname.match(/^\/v1\/shipments\/([0-9a-f-]{36})\/addresses$/i);
  if(address&&["GET","POST"].includes(request.method)){
    const actor=await authenticatedUser(request,authService);
    const result=request.method==="GET"?{items:await logisticsService.sharedAddresses(actor.id,address[1])}:
      {share:await logisticsService.shareAddress(actor.id,address[1],await readJson(request))};
    sendJson(response,request.method==="POST"&&!result.share.reused?201:200,{...result,requestId},{...headers,"cache-control":"no-store"});return true;
  }
  const settlement=url.pathname.match(/^\/v1\/shipments\/([0-9a-f-]{36})\/settlement-status$/i);
  if(settlement && request.method==="GET"){
    const actor=await authenticatedUser(request,authService);
    const status=await logisticsService.settlementStatus(actor,settlement[1]);
    sendJson(response,200,{settlement:status,requestId},{...headers,"cache-control":"no-store"});return true;
  }
  const courierPayout=url.pathname.match(/^\/v1\/shipments\/([0-9a-f-]{36})\/courier-payout$/i);
  if(courierPayout&&['GET','POST'].includes(request.method)){
    const actor=await authenticatedUser(request,authService);const result=request.method==='GET'?await logisticsService.courierPayoutStatus(actor,courierPayout[1]):await logisticsService.prepareCourierPayout(actor,courierPayout[1],await readJson(request));
    sendJson(response,request.method==='POST'&&!result.reused?201:200,{payout:result,requestId},{...headers,'cache-control':'no-store'});return true;
  }
  const photo=url.pathname.match(/^\/v1\/shipments\/([0-9a-f-]{36})\/proof\/photo$/i);
  if(photo && request.method==="GET"){
    const actor=await authenticatedUser(request,authService);
    const image=await logisticsService.proofPhoto(actor,photo[1]);
    sendJson(response,200,{image,requestId},{...headers,"cache-control":"no-store","pragma":"no-cache"});return true;
  }
  const receipt=url.pathname.match(/^\/v1\/shipments\/([0-9a-f-]{36})\/(receipt|proof\/validate|proof)$/i);
  if(receipt && request.method==="GET" && receipt[2]==="proof"){
    const actor=await authenticatedUser(request,authService);
    const proof=await logisticsService.receiptEvidence(actor,receipt[1]);
    sendJson(response,200,{proof,requestId},headers);return true;
  }
  if(receipt && request.method==="POST" && receipt[2]!=="proof"){
    const actor=await authenticatedUser(request,authService);
    const input=await readJson(request);
    const result=receipt[2]==="receipt"
      ? await logisticsService.approveReceipt(actor.id,receipt[1],input)
      : await logisticsService.validateProof(actor,receipt[1],input);
    sendJson(response,result.reused?200:201,{decision:result,requestId},headers);return true;
  }
  if(request.method==="POST"&&url.pathname==="/v1/shipments"){
    const actor=await authenticatedUser(request,authService);const result=await logisticsService.create(actor.id,await readJson(request));
    sendJson(response,result.reused?200:201,{...result,requestId},headers);return true;
  }
  const detail=url.pathname.match(/^\/v1\/shipments\/([0-9a-f-]{36})$/i);
  if(request.method==="GET"&&detail){const actor=await authenticatedUser(request,authService);const shipment=await logisticsService.detail(actor.id,detail[1]);sendJson(response,200,{shipment,requestId},headers);return true}
  const collection=url.pathname.match(/^\/v1\/shipments\/([0-9a-f-]{36})\/collection$/i);
  if(request.method==='POST'&&collection){const actor=await authenticatedUser(request,authService);if(actor.role!=='courier'&&actor.role!=='admin')throw new AuthError('forbidden',403,'Acesso não autorizado.');const result=await logisticsService.collect(actor.id,collection[1],await readJson(request));sendJson(response,result.reused?200:201,{collection:result,requestId},{...headers,'cache-control':'no-store'});return true;}
  const courierContact=url.pathname.match(/^\/v1\/shipments\/([0-9a-f-]{36})\/contact$/i);
  if(request.method==='GET'&&courierContact){const actor=await authenticatedUser(request,authService);const contact=await logisticsService.courierContact(actor,courierContact[1]);sendJson(response,200,{contact,requestId},{...headers,'cache-control':'no-store'});return true;}
  const assign=url.pathname.match(/^\/v1\/shipments\/([0-9a-f-]{36})\/assign$/i);
  if(request.method==="POST"&&assign){const actor=await authenticatedUser(request,authService);if(actor.role!=="courier"&&actor.role!=="admin")throw new AuthError("forbidden",403,"Acesso não autorizado.");const shipment=await logisticsService.assign(actor.id,assign[1]);sendJson(response,200,{shipment,requestId},headers);return true}
  const proof=url.pathname.match(/^\/v1\/shipments\/([0-9a-f-]{36})\/proof$/i);
  if(request.method==="POST"&&proof){const actor=await authenticatedUser(request,authService);if(actor.role!=="courier"&&actor.role!=="admin")throw new AuthError("forbidden",403,"Acesso não autorizado.");const result=await logisticsService.proof(actor.id,proof[1],await readJson(request));sendJson(response,201,{proof:result,requestId},headers);return true}
  return false;
}

