export class LogisticsProviderError extends Error {
  constructor(code="logistics_provider_unavailable",message="Provedor logístico indisponível.") {
    super(message); this.code=code; this.status=503;
  }
}
export function createLogisticsProvider(config,{fetchImpl=fetch}={}) {
  const endpoint=config.logisticsProviderUrl?new URL(config.logisticsProviderUrl):null;
  const secret=config.logisticsProviderSecret;
  return Object.freeze({
    configured:Boolean(endpoint),
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
