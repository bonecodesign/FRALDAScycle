import { createHash, createHmac, timingSafeEqual } from "node:crypto";
export class LogisticsProviderError extends Error {
  constructor(code="logistics_provider_unavailable",message="Provedor logístico indisponível.") {
    super(message); this.code=code; this.status=503;
  }
}
export function createLogisticsProvider(config,{fetchImpl=fetch}={}) {
  const endpoint=config.logisticsProviderUrl?new URL(config.logisticsProviderUrl):null;
  const secret=config.logisticsProviderSecret;
  const webhookSecret=config.logisticsWebhookSecret;
  return Object.freeze({
    configured:Boolean(endpoint),
    verifyWebhook({raw,timestamp,signature,now=Date.now}){
      if(!webhookSecret)throw new LogisticsProviderError("logistics_webhook_not_configured","Webhook logístico não configurado.");
      const seconds=Number(timestamp);
      if(!Number.isInteger(seconds)||Math.abs(Math.floor(now()/1000)-seconds)>300){const error=new LogisticsProviderError("invalid_logistics_webhook_timestamp","Webhook logístico inválido.");error.status=401;throw error}
      const receivedHex=String(signature??"").replace(/^v1=/,"");
      if(!/^[0-9a-f]{64}$/i.test(receivedHex)){const error=new LogisticsProviderError("invalid_logistics_webhook_signature","Webhook logístico inválido.");error.status=401;throw error}
      const expected=createHmac("sha256",webhookSecret).update(`${seconds}.`).update(raw).digest();const received=Buffer.from(receivedHex,"hex");
      if(received.length!==expected.length||!timingSafeEqual(received,expected)){const error=new LogisticsProviderError("invalid_logistics_webhook_signature","Webhook logístico inválido.");error.status=401;throw error}
      let value;try{value=JSON.parse(raw.toString("utf8"))}catch{const error=new LogisticsProviderError("invalid_logistics_webhook_payload","Webhook logístico inválido.");error.status=400;throw error}
      const types=["shipment.assigned","shipment.picked_up","shipment.in_transit","shipment.delivered","shipment.failed","shipment.cancelled"];
      const latitude=value?.data?.latitude;const longitude=value?.data?.longitude;
      if(typeof value?.id!=="string"||value.id.length>128||!types.includes(value?.type)||typeof value?.data?.reference!=="string"||!Number.isFinite(Date.parse(value?.createdAt))||(latitude==null)!==(longitude==null)||(latitude!=null&&(!Number.isFinite(latitude)||latitude< -90||latitude>90||!Number.isFinite(longitude)||longitude< -180||longitude>180))){
        const error=new LogisticsProviderError("invalid_logistics_webhook_payload","Webhook logístico inválido.");error.status=422;throw error
      }
      return {id:value.id,type:value.type,providerReference:value.data.reference,latitude:latitude??null,longitude:longitude??null,description:String(value.data.description??value.type).slice(0,240),occurredAt:new Date(value.createdAt),payloadHash:createHash("sha256").update(raw).digest()}
    },
    async createShipment(input) {
      if(!endpoint||!secret)throw new LogisticsProviderError("logistics_provider_not_configured","Provedor logístico não configurado.");
      let response;
      try{response=await fetchImpl(new URL("/shipments",endpoint),{
        method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${secret}`,"idempotency-key":input.idempotencyKey},
        body:JSON.stringify({reference:input.shipmentId,mode:input.mode,insured:input.insured,transactionReference:input.transactionId}),
        signal:AbortSignal.timeout(5000),
      })}catch{throw new LogisticsProviderError()}
      if(!response.ok)throw new LogisticsProviderError();
      const payload=await response.json();
      if(typeof payload?.reference!=="string"||!["awaiting_pickup","assigned"].includes(payload?.status)||!Number.isFinite(Date.parse(payload?.estimatedDeliveryAt))){
        throw new LogisticsProviderError("logistics_provider_invalid_response","Resposta inválida do provedor logístico.");
      }
      return {providerReference:payload.reference,status:payload.status,estimatedDeliveryAt:new Date(payload.estimatedDeliveryAt)};
    },
  });
}
