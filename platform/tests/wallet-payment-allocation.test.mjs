import assert from 'node:assert/strict';
import test from 'node:test';
import {proportionalWalletRefund,walletCommercialAllocation,walletPurchaseAllocation} from '../packages/contracts/wallet-payment-allocation.js';

test('purchase allocation preserves the gross total for wallet-only and mixed payments',()=>{
  assert.deepEqual(walletPurchaseAllocation({grossCents:10000,walletCents:10000,walletAvailableCents:12000}),{grossCents:10000,walletCents:10000,externalCents:0,fullyCoveredByWallet:true});
  assert.deepEqual(walletPurchaseAllocation({grossCents:10000,walletCents:3500,walletAvailableCents:3500}),{grossCents:10000,walletCents:3500,externalCents:6500,fullyCoveredByWallet:false});
  assert.throws(()=>walletPurchaseAllocation({grossCents:10000,walletCents:3501,walletAvailableCents:3500}),/wallet_amount_unavailable/);
});

test('refund returns the exact amount proportionally to both origins',()=>{
  assert.deepEqual(proportionalWalletRefund({grossCents:10000,walletCents:3500,refundCents:8000}),{refundCents:8000,walletRefundCents:2800,externalRefundCents:5200});
  const odd=proportionalWalletRefund({grossCents:3,walletCents:1,refundCents:2});
  assert.equal(odd.walletRefundCents+odd.externalRefundCents,2);
  assert.deepEqual(proportionalWalletRefund({grossCents:10000,walletCents:10000,refundCents:1234}),{refundCents:1234,walletRefundCents:1234,externalRefundCents:0});
});

test('commercial split sent to provider equals only the external remainder',()=>{
  assert.deepEqual(walletCommercialAllocation({grossCents:10000,walletCents:3500,platformFeeCents:800,sellerCents:9200}),{walletPlatformCents:280,walletSellerCents:3220,externalPlatformCents:520,externalSellerCents:5980});
});
