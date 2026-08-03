export class LogisticsError extends Error {
  constructor(code,status,message){super(message);this.code=code;this.status=status}
}
const MODES=new Set(["pickup","partner","postal","express"]);
const ELIGIBLE=new Set(["paid","in_delivery"]);
function publicShipment(row){return {
  id:row.id,transactionId:row.transaction_id,mode:row.mode,insured:row.insured,
  status:row.status,estimatedDeliveryAt:row.estimated_delivery_at??null,events:row.events??[],
}}
export function createLogisticsService(repository,provider){
  return Object.freeze({
    async create(buyerId,input){
      const transactionId=String(input?.transactionId??"");const mode=String(input?.mode??"");
      const idempotencyKey=String(input?.idempotencyKey??"").trim();const insured=Boolean(input?.insured);
      if(!/^[0-9a-f-]{36}$/i.test(transactionId))throw new LogisticsError("invalid_transaction",422,"Transação inválida.");
      if(!MODES.has(mode))throw new LogisticsError("invalid_shipment_mode",422,"Modalidade de entrega inválida.");
      if(idempotencyKey.length<16||idempotencyKey.length>128)throw new LogisticsError("invalid_idempotency_key",422,"Chave de idempotência inválida.");
      const context=await repository.context({buyerId,transactionId,idempotencyKey});
      if(context.existing)return {shipment:publicShipment(context.shipment),reused:true};
      const transaction=context.transaction;if(!transaction)throw new LogisticsError("transaction_not_found",404,"Transação não encontrada.");
      if(!ELIGIBLE.has(transaction.status))throw new LogisticsError("shipment_not_allowed",409,"Esta transação ainda não permite entrega.");
      const created=await repository.createShipment({transactionId,buyerId,sellerId:transaction.seller_id,mode,insured,idempotencyKey});
      if(mode==="pickup")return {shipment:publicShipment(created),reused:false};
      const remote=await provider.createShipment({shipmentId:created.id,transactionId,mode,insured,idempotencyKey});
      const attached=await repository.attachProvider({shipmentId:created.id,...remote});
      return {shipment:publicShipment(attached),reused:false};
    },
    async assign(courierId,shipmentId){
      const shipment=await repository.assignCourier({courierId,shipmentId});
      if(!shipment)throw new LogisticsError("shipment_not_available",409,"Entrega não está disponível.");
      return publicShipment(shipment);
    },
    async detail(userId,shipmentId){
      const shipment=await repository.detail({userId,shipmentId});
      if(!shipment)throw new LogisticsError("shipment_not_found",404,"Entrega não encontrada.");
      return publicShipment(shipment);
    },
    async proof(courierId,shipmentId,input){
      const mediaKey=String(input?.mediaKey??"").trim();const recipientName=String(input?.recipientName??"").trim();
      const latitude=Number(input?.latitude);const longitude=Number(input?.longitude);
      if(!/^[a-zA-Z0-9/_-]{8,512}$/.test(mediaKey))throw new LogisticsError("invalid_proof_media",422,"Envie uma foto válida.");
      if(recipientName.length<2||recipientName.length>100)throw new LogisticsError("invalid_recipient",422,"Informe quem recebeu.");
      if(!Number.isFinite(latitude)||latitude< -90||latitude>90||!Number.isFinite(longitude)||longitude< -180||longitude>180)throw new LogisticsError("invalid_location",422,"Localização da entrega inválida.");
      const proof=await repository.addProof({courierId,shipmentId,mediaKey,recipientName,latitude,longitude});
      if(!proof)throw new LogisticsError("shipment_not_assigned",403,"Entrega não atribuída a este entregador.");
      return proof;
    },
  })
}
