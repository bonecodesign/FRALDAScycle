import { ServiceError } from "./service-error.js";
import { hasScope, requireScope } from "./authorization.js";
import { institutionReceiptReadiness } from "../../packages/contracts/institution-receipt-readiness.js";
import { sellerSettlementReadiness } from "../../packages/contracts/settlement-readiness.js";
export class LogisticsError extends ServiceError {
  constructor(code, status, message) {
    super(code, status, message);
  }
}
const MODES=new Set(["pickup","partner","postal","express"]);
const ELIGIBLE=new Set(["paid","in_delivery"]);
function publicShipment(row){return {
  id:row.id,transactionId:row.transaction_id,mode:row.mode,insured:row.insured,
  status:row.status,estimatedDeliveryAt:row.estimated_delivery_at??null,events:row.events??[],
}}
export function createLogisticsService(repository,provider,mediaProvider){
  return Object.freeze({
    ownAddresses(userId) { return repository.ownAddresses(userId); },
    async createAddress(userId,input) {
      const address={};
      for(const field of ["label","street","number","district","city"]) {
        address[field]=String(input?.[field]??"").trim();
        if(address[field].length<1||address[field].length>150)throw new LogisticsError("invalid_address",422,"Preencha os campos do endereço.");
      }
      address.postalCode=String(input?.postalCode??"").replace(/\D/g,"");
      address.state=String(input?.state??"").trim().toUpperCase();
      address.complement=String(input?.complement??"").trim()||null;
      if(!/^\d{8}$/.test(address.postalCode)||
        !["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].includes(address.state)||
        (address.complement&&address.complement.length>150))throw new LogisticsError("invalid_address",422,"Informe CEP, estado e complemento válidos.");
      return repository.createAddress(userId,address);
    },
    async shareAddress(userId,shipmentId,input) {
      if(input?.confirmed!==true||input?.noticeVersion!=="FC-ADDRESS-1")throw new LogisticsError("address_consent_required",422,"Confirme o aviso de compartilhamento do endereço.");
      const addressId=String(input?.addressId??"");
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(addressId))throw new LogisticsError("invalid_address",422,"Selecione seu endereço.");
      return repository.shareAddress({actorId:userId,shipmentId,addressId});
    },
    sharedAddresses(userId,shipmentId) { return repository.sharedAddresses({userId,shipmentId}); },
    async settlementStatus(actor, shipmentId) {
      const proof = await repository.receiptEvidence({ userId: actor.id, shipmentId,
        reviewer: hasScope(actor, "admin:deliveries:validate") });
      if (!proof) throw new LogisticsError("receipt_not_found", 404, "Recebimento não encontrado.");
      return proof.kind==='donation'?institutionReceiptReadiness(proof):sellerSettlementReadiness(proof);
    },
    async proofPhoto(actor, shipmentId) {
      const proof = await repository.receiptEvidence({ userId: actor.id, shipmentId,
        reviewer: hasScope(actor, "admin:deliveries:validate") });
      if (!proof) throw new LogisticsError("receipt_not_found", 404, "Comprovante não encontrado.");
      if (!mediaProvider) throw new LogisticsError("provider_not_configured", 503, "A leitura privada da foto ainda não foi configurada.");
      return mediaProvider.signedProofRead(actor.id, proof.media_key);
    },
    async receiptEvidence(actor, shipmentId) {
      const proof = await repository.receiptEvidence({
        userId: actor.id, shipmentId, reviewer: hasScope(actor, "admin:deliveries:validate"),
      });
      if (!proof) throw new LogisticsError("receipt_not_found", 404, "Comprovante não encontrado.");
      return {
        id: proof.id, mediaKey: proof.media_key, courierId: proof.courier_id,
        createdAt: proof.created_at, approvedAt: proof.approved_at ?? null,
        validatedAt: proof.validated_at ?? null, payoutStatus: "not_configured",
      };
    },
    async approveReceipt(actorId, shipmentId, input) {
      if (input?.approved !== true) throw new LogisticsError("explicit_approval_required", 422, "Confirme explicitamente que recebeu e verificou o produto.");
      return repository.recordReceiptDecision({ actorId, shipmentId });
    },
    async validateProof(actor, shipmentId, input) {
      requireScope(actor, "admin:deliveries:validate");
      const reason = String(input?.reason ?? "").trim();
      if (input?.validated !== true || reason.length < 10 || reason.length > 1000) {
        throw new LogisticsError("invalid_proof_validation", 422, "Confirme a validação e registre sua justificativa.");
      }
      return repository.recordReceiptDecision({ actorId: actor.id, shipmentId, validation: true, reason });
    },
    async processWebhook(event){
      const result=await repository.processWebhook(event);
      if(result.missing)throw new LogisticsError("shipment_not_found",404,"Entrega não encontrada.");
      return {accepted:true,duplicate:Boolean(result.duplicate),ignored:Boolean(result.ignored),status:result.status??null};
    },
    async create(buyerId,input){
      const transactionId=String(input?.transactionId??"");const mode=String(input?.mode??"");
      const idempotencyKey=String(input?.idempotencyKey??"").trim();const insured=Boolean(input?.insured);
      if(!/^[0-9a-f-]{36}$/i.test(transactionId))throw new LogisticsError("invalid_transaction",422,"Transação inválida.");
      if(!MODES.has(mode))throw new LogisticsError("invalid_shipment_mode",422,"Modalidade de entrega inválida.");
      if(idempotencyKey.length<16||idempotencyKey.length>128)throw new LogisticsError("invalid_idempotency_key",422,"Chave de idempotência inválida.");
      const context=await repository.context({buyerId,transactionId,idempotencyKey,mode,insured});
      if(context.existing){
        const existing=context.shipment;
        if(existing.buyer_id!==buyerId||existing.transaction_id!==transactionId||existing.mode!==mode||existing.insured!==insured)throw new LogisticsError('shipment_idempotency_conflict',409,'Chave de idempotência já utilizada para outra solicitação.');
        return {shipment:publicShipment(existing),reused:true};
      }
      const transaction=context.transaction;if(!transaction)throw new LogisticsError("transaction_not_found",404,"Transação não encontrada.");
      if(!ELIGIBLE.has(transaction.status))throw new LogisticsError("shipment_not_allowed",409,"Esta transação ainda não permite entrega.");
      const created=await repository.createShipment({transactionId,buyerId,sellerId:transaction.seller_id,mode,insured,idempotencyKey});
      if(created.reused)return {shipment:publicShipment(created),reused:true};
      if(mode==="pickup")return {shipment:publicShipment(created),reused:false};
      const remote=await provider.createShipment({shipmentId:created.id,transactionId,mode,insured,idempotencyKey});
      const attached=await repository.attachProvider({shipmentId:created.id,...remote});
      return {shipment:publicShipment(attached),reused:false};
    },
    async collect(courierId,shipmentId,input){
      if(input?.confirmed!==true||input?.noticeVersion!=='FC-COLLECTION-1'||Object.keys(input).some(key=>!['confirmed','noticeVersion'].includes(key)))throw new LogisticsError('explicit_collection_required',422,'Confirme explicitamente a coleta da entrega atribuída.');
      return repository.collect({courierId,shipmentId});
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

