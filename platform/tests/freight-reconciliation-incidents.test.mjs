import assert from "node:assert/strict";
import test from "node:test";
import { createFreightSettlementService } from "../apps/api/freight-settlement-service.js";

const actor={id:"11111111-1111-4111-8111-111111111111",role:"admin",staffSector:"finance",staffAccessLevel:3};
const id="22222222-2222-4222-8222-222222222222";
const row={
  id,delivery_quote_id:id,transaction_id:id,payer_id:actor.id,
  provider:"lalamove",provider_amount_cents:2000,platform_fee_cents:100,customer_total_cents:2100,
  current_quote_id:id,quote_status:"locked",quote_confirmed_by:actor.id,
  quote_provider:"lalamove",quote_base_freight_cents:2000,quote_platform_fee_cents:100,quote_total_cents:2100,
  current_transaction_id:id,product_amount_cents:10000,kind:"sale",
  payment_id:id,payment_status:"paid",payment_provider_reference:"fixture",
  payment_amount_cents:12100,payment_platform_fee_cents:900,
  payment_delivery_fee_cents:2000,payment_seller_amount_cents:9200,
  paid_count:1,financial_case_pending:false,
};
test("finance records only local discrepancies, never marks provider reconciled",async()=>{
  let input, observed={...row,payment_delivery_fee_cents:1900};
  const service=createFreightSettlementService({
    context:async()=>observed,
    recordIncidents:async args=>(input=args,[{code:args.codes[0],status:"open"}]),
  });
  await assert.rejects(service.checkAndRecord(actor,id,{}),{code:"freight_reconciliation_confirmation_required"});
  await assert.rejects(service.checkAndRecord({...actor,staffSector:"operations"},id,{confirmed:true}));
  const first=await service.checkAndRecord(actor,id,{confirmed:true});
  assert.deepEqual(input.codes,["payment_split_mismatch"]);
  assert.equal(first.reconciliation.payoutAllowed,false);
  assert.equal(first.incidents[0].code,"payment_split_mismatch");
  observed=row;
  await service.checkAndRecord(actor,id,{confirmed:true});
  assert.deepEqual(input.codes,[]);
});
