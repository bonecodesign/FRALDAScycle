import {saleSplit,exchangeFee,externalPartnerDeliveryCharge,freightResponsibility} from './commercial-rules.js';
import {exchangeDifference} from './exchange-difference.js';
import {projectProductProcessingCost} from './product-processing-cost.js';

// Read-only, local simulation. No payment instruction, webhook, provider
// verification, payout authorization, tax quotation or operational launch.
const MAX_CENTS=2147483647;
function positive(value,label,max=MAX_CENTS){
  if(!Number.isSafeInteger(value)||value<=0||value>max)throw new RangeError('Invalid '+label);
  return value;
}
function sum(...amounts){
  const result=amounts.reduce((total,amount)=>total+amount,0);
  if(!Number.isSafeInteger(result)||result>MAX_CENTS)throw new RangeError('Financial simulation exceeds supported amount');
  return result;
}
const gates=()=>Object.freeze({
  simulationOnly:true,
  providerReconciled:false,
  externalChargeCreated:false,
  payoutAllowed:false,
  launchAuthorized:false,
});

export function previewSaleFinances({productCents,freightBaseCents}={}){
  positive(productCents,'productCents');
  positive(freightBaseCents,'freightBaseCents');
  const split=saleSplit(productCents);
  const freight=externalPartnerDeliveryCharge(freightBaseCents);
  const processing=projectProductProcessingCost({productAmountCents:productCents});
  const buyerTotalCents=sum(productCents,freight.customerTotalCents);
  const platformCommissionCents=sum(split.platformCents,freight.platformCents);
  if(sum(split.sellerCents,freight.partnerCents,platformCommissionCents)!==buyerTotalCents)throw new Error('Non-conserving sale allocation');
  return Object.freeze({
    operation:'sale',currency:'BRL',
    buyerTotalCents,
    buyerProductCents:productCents,
    buyerFreightCents:freight.customerTotalCents,
    productCommissionCents:split.platformCents,
    freightCommissionCents:freight.platformCents,
    platformCommissionCents,
    partnerFreightCents:freight.partnerCents,
    sellerBeforeProcessingCents:split.sellerCents,
    sellerAfterProcessingCents:processing.sellerAfterProcessingFeeCents,
    processorFeeCents:processing.providerProcessingFeeCents,
    productProcessingFeePayer:processing.processingFeePayer,
    freightResponsibility:freightResponsibility('sale'),
    blockers:Object.freeze(['processor_fee_unknown','processor_contract_not_homologated','freight_provider_not_homologated','external_reconciliation_not_homologated']),
    ...gates(),
  });
}

export function previewExchangeFinances({requesterValueCents,ownerValueCents,requesterReceivingFreightCents,ownerReceivingFreightCents}={}){
  positive(requesterValueCents,'requesterValueCents',100_000_000);
  positive(ownerValueCents,'ownerValueCents',100_000_000);
  positive(requesterReceivingFreightCents,'requesterReceivingFreightCents');
  positive(ownerReceivingFreightCents,'ownerReceivingFreightCents');
  const difference=exchangeDifference({
    requesterId:'requester',ownerId:'owner',
    requesterDeclaredValueCents:requesterValueCents,
    ownerDeclaredValueCents:ownerValueCents,
  });
  const requesterFreight=externalPartnerDeliveryCharge(requesterReceivingFreightCents);
  const ownerFreight=externalPartnerDeliveryCharge(ownerReceivingFreightCents);
  const build=(participant,offeredValueCents,freight)=>{
    const fee=exchangeFee(offeredValueCents);
    const differenceToPayCents=difference?.payerId===participant?difference.amountCents:0;
    const differenceToReceiveCents=difference?.recipientId===participant?difference.amountCents:0;
    return Object.freeze({
      offeredValueCents,exchangeCommissionCents:fee,
      freightBaseCents:freight.partnerCents,
      freightCommissionCents:freight.platformCents,
      freightTotalCents:freight.customerTotalCents,
      differenceToPayCents,differenceToReceiveCents,
      indicativeObligationBeforeProcessingCents:sum(fee,freight.customerTotalCents,differenceToPayCents),
      processorFeeCents:null,
    });
  };
  const requester=build('requester',requesterValueCents,requesterFreight);
  const owner=build('owner',ownerValueCents,ownerFreight);
  return Object.freeze({
    operation:'exchange',currency:'BRL',
    requester,owner,
    difference: difference?Object.freeze({payer:difference.payerId,recipient:difference.recipientId,amountCents:difference.amountCents,status:'not_charged'}):null,
    exchangeCommissionCents:sum(requester.exchangeCommissionCents,owner.exchangeCommissionCents),
    freightCommissionCents:sum(requester.freightCommissionCents,owner.freightCommissionCents),
    platformCommissionCents:sum(requester.exchangeCommissionCents,owner.exchangeCommissionCents,requester.freightCommissionCents,owner.freightCommissionCents),
    freightResponsibility:freightResponsibility('exchange'),
    blockers:Object.freeze(['two_freight_legs_not_homologated','processor_fee_unknown','exchange_difference_provider_not_homologated','external_reconciliation_not_homologated']),
    ...gates(),
  });
}

export function previewInstitutionalDonationFinances(){
  return Object.freeze({
    operation:'donation',currency:'BRL',
    buyerTotalCents:0,platformCommissionCents:0,freightCents:0,
    pickup:'institutional',
    paymentRequired:false,
    blockers:Object.freeze(['institutional_pickup_not_homologated']),
    ...gates(),
  });
}
