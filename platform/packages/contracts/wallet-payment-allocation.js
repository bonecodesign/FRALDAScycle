function integer(value,name,{positive=false}={}){
  if(!Number.isSafeInteger(value)||(positive?value<=0:value<0))throw new RangeError(`invalid_${name}`);
  return value;
}

export function walletPurchaseAllocation({grossCents,walletCents,walletAvailableCents}){
  const gross=integer(grossCents,'gross',{positive:true});
  const wallet=integer(walletCents,'wallet');
  const available=integer(walletAvailableCents,'wallet_available');
  if(wallet>gross||wallet>available)throw new RangeError('wallet_amount_unavailable');
  return Object.freeze({grossCents:gross,walletCents:wallet,externalCents:gross-wallet,fullyCoveredByWallet:wallet===gross});
}

export function proportionalWalletRefund({grossCents,walletCents,refundCents}){
  const gross=integer(grossCents,'gross',{positive:true});
  const wallet=integer(walletCents,'wallet');
  const refund=integer(refundCents,'refund');
  if(wallet>gross||refund>gross)throw new RangeError('invalid_refund_allocation');
  const walletRefund=Number((BigInt(refund)*BigInt(wallet)+BigInt(Math.floor(gross/2)))/BigInt(gross));
  const boundedWallet=Math.min(wallet,walletRefund);
  return Object.freeze({refundCents:refund,walletRefundCents:boundedWallet,externalRefundCents:refund-boundedWallet});
}

export function walletCommercialAllocation({grossCents,walletCents,platformFeeCents,sellerCents}){
  const gross=integer(grossCents,'gross',{positive:true}),wallet=integer(walletCents,'wallet');
  const platform=integer(platformFeeCents,'platform_fee'),seller=integer(sellerCents,'seller');
  if(platform+seller!==gross||wallet>gross)throw new RangeError('invalid_commercial_allocation');
  const external=gross-wallet;
  const externalPlatform=Number((BigInt(platform)*BigInt(external)+BigInt(Math.floor(gross/2)))/BigInt(gross));
  const externalSeller=external-externalPlatform;
  return Object.freeze({walletPlatformCents:platform-externalPlatform,walletSellerCents:seller-externalSeller,externalPlatformCents:externalPlatform,externalSellerCents:externalSeller});
}
