import { deliverySplit,externalPartnerDeliveryCharge } from '../../packages/contracts/commercial-rules.js';
import { deliveryQuoteRequestFingerprint } from '../../packages/contracts/delivery-quote-cache-policy.js';
const PROVIDERS=new Set(['lalamove','fraldacycle_courier','loggi_express','uber_direct']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=(code,message)=>Object.assign(new Error(message),{code,status:422});
function registration(transactionId,shipmentId,quote,request){
  if(!UUID.test(String(transactionId??''))||(shipmentId!==null&&!UUID.test(String(shipmentId??'')))||!PROVIDERS.has(quote?.provider)||typeof quote.quoteId!=='string'||quote.quoteId.length<8||!Number.isSafeInteger(quote.baseFreightCents)||quote.baseFreightCents<=0||quote.currency!=='BRL'||Date.parse(quote.expiresAt)<=Date.now())throw fail('invalid_delivery_quote','Cotação de entrega inválida.');
  const external=quote.provider!=='fraldacycle_courier',split=external?externalPartnerDeliveryCharge(quote.baseFreightCents):deliverySplit(quote.baseFreightCents);
  if(quote.customerTotalCents!==split.customerTotalCents)throw fail('invalid_delivery_quote_total','Total de entrega inválido.');
  return {transactionId,shipmentId,provider:quote.provider,providerQuoteId:quote.quoteId,requestFingerprint:deliveryQuoteRequestFingerprint(request),baseFreightCents:quote.baseFreightCents,platformFeeCents:split.platformCents,customerTotalCents:split.customerTotalCents,expiresAt:new Date(quote.expiresAt).toISOString()};
}
export function createDeliveryQuoteService(repository){return Object.freeze({
  registerCalculated(transactionId,quote,request){return repository.register(registration(transactionId,null,quote,request));},
  registerCalculatedForShipment(transactionId,shipmentId,quote,request){return repository.register(registration(transactionId,shipmentId,quote,request));},
  confirm(userId,input){if(!input||Object.keys(input).some(key=>!['quoteId','providerQuoteId','customerTotalCents','request'].includes(key))||!UUID.test(String(input.quoteId??''))||typeof input.providerQuoteId!=='string'||input.providerQuoteId.length<8||!Number.isSafeInteger(input.customerTotalCents)||input.customerTotalCents<=0)throw fail('invalid_delivery_quote_confirmation','Confira e confirme a cotação atual.');return repository.confirm({userId,quoteId:input.quoteId,providerQuoteId:input.providerQuoteId,totalCents:input.customerTotalCents,requestFingerprint:deliveryQuoteRequestFingerprint(input.request)});},
});}
