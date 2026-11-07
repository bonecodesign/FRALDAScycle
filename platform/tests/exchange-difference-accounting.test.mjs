import assert from "node:assert/strict";
import test from "node:test";
import {exchangeDifferenceAccounting} from "../packages/contracts/exchange-difference-accounting.js";
import {createFreightSettlementService} from "../apps/api/freight-settlement-service.js";

const transaction="11111111-1111-4111-8111-111111111111";
const requester="22222222-2222-4222-8222-222222222222";
const owner="33333333-3333-4333-8333-333333333333";
const requestedListing="44444444-4444-4444-8444-444444444444";
const offeredListing="55555555-5555-4555-8555-555555555555";
const operation=()=>({
  transaction_id:transaction,status:"accepted",requester_id:requester,owner_id:owner,
  requested_listing_id:requestedListing,offered_listing_id:offeredListing,
  requester_declared_value_cents:8000,owner_declared_value_cents:10000,
});
const fees=()=>[
  {transaction_id:transaction,participant_id:requester,offered_listing_id:offeredListing,
    declared_value_cents:8000,fee_basis_points:250,fee_cents:200,status:"not_charged"},
  {transaction_id:transaction,participant_id:owner,offered_listing_id:requestedListing,
    declared_value_cents:10000,fee_basis_points:250,fee_cents:250,status:"not_charged"},
];
const difference=()=>({
  transaction_id:transaction,payer_id:requester,recipient_id:owner,
  lower_value_cents:8000,higher_value_cents:10000,amount_cents:2000,status:"not_charged",
});
const audit=(options={})=>exchangeDifferenceAccounting({
  operation:options.operation??operation(),
  feeRows:options.feeRows??fees(),
  differenceRow:options.differenceRow===undefined?difference():options.differenceRow,
});

test("requirement 10: independent fees and difference are conserved by payer without creating charges",()=>{
  const result=audit();
  assert.equal(result.localConsistent,true);
  assert.deepEqual(result.blockers,[]);
  assert.deepEqual(result.participants.map(p=>({
    fee:p.feeCents,difference:p.differenceToPayCents,combined:p.combinedLocalObligationCents,
    tariff:p.providerProcessingFeeCents,
  })),[
    {fee:200,difference:2000,combined:2200,tariff:null},
    {fee:250,difference:0,combined:250,tariff:null},
  ]);
  assert.equal(result.difference.payerId,requester);
  assert.equal(result.difference.recipientId,owner);
  assert.equal(result.difference.amountCents,2000);
  assert.equal(result.providerReconciled,false);
  assert.equal(result.payoutAllowed,false);
  assert.equal(result.externalChargeCreated,false);
  assert.equal(result.processingFeeHomologated,false);
});

test("requirement 10: equal values create no difference, only independent 2.5% fee obligations",()=>{
  const op={...operation(),requester_declared_value_cents:10000};
  const fee=fees().map(f=>f.participant_id===requester?{...f,declared_value_cents:10000,fee_cents:250}:f);
  const result=audit({operation:op,feeRows:fee,differenceRow:null});
  assert.equal(result.localConsistent,true);
  assert.equal(result.difference,null);
  assert.deepEqual(result.participants.map(p=>p.combinedLocalObligationCents),[250,250]);
});

test("requirement 10: payer direction reverses for higher requester offer",()=>{
  const op={...operation(),requester_declared_value_cents:12000};
  const fee=fees().map(f=>f.participant_id===requester?{...f,declared_value_cents:12000,fee_cents:300}:f);
  const diff={...difference(),payer_id:owner,recipient_id:requester,lower_value_cents:10000,
    higher_value_cents:12000};
  const result=audit({operation:op,feeRows:fee,differenceRow:diff});
  assert.equal(result.localConsistent,true);
  assert.deepEqual(result.participants.map(p=>p.combinedLocalObligationCents),[300,2250]);
});

test("requirement 10: wrong person, value, fee, cardinality or unexpected difference fail closed",()=>{
  const cases=[
    [{feeRows:fees().slice(0,1)},"exchange_fee_cardinality_invalid"],
    [{feeRows:[fees()[0],{...fees()[1],fee_cents:251}]},"exchange_fee_snapshot_mismatch"],
    [{feeRows:[fees()[0],{...fees()[1],offered_listing_id:offeredListing}]},"exchange_fee_snapshot_mismatch"],
    [{feeRows:[fees()[0],{...fees()[1],participant_id:"66666666-6666-4666-8666-666666666666"}]},"exchange_fee_participant_invalid"],
    [{differenceRow:{...difference(),payer_id:owner}},"exchange_difference_snapshot_mismatch"],
    [{differenceRow:{...difference(),amount_cents:1999}},"exchange_difference_snapshot_mismatch"],
    [{differenceRow:null},"exchange_difference_missing"],
    [{operation:{...operation(),status:"cancelled"}},"exchange_not_accepted"],
    [{operation:{...operation(),owner_declared_value_cents:null}},"exchange_declared_values_invalid"],
  ];
  for (const [input,code] of cases) {
    const result=audit(input);
    assert.equal(result.localConsistent,false,code);
    assert.ok(result.blockers.includes(code),code);
    assert.ok(result.participants.every(p=>p.combinedLocalObligationCents===null),code);
    assert.equal(result.payoutAllowed,false,code);
  }
  const equal={...operation(),requester_declared_value_cents:10000};
  const unexpected=audit({operation:equal,differenceRow:difference()});
  assert.ok(unexpected.blockers.includes("exchange_difference_unexpected"));
});

test("requirement 10: only finance sector may review the local accounting report",async()=>{
  const service=createFreightSettlementService({
    async exchangeDifferenceContext(){return {...operation(),fee_rows:fees(),difference_row:difference()};},
  });
  const finance={id:"77777777-7777-4777-8777-777777777777",role:"admin",
    staffSector:"finance",staffAccessLevel:3};
  assert.equal((await service.exchangeDifferenceAccounting(finance,transaction)).localConsistent,true);
  await assert.rejects(service.exchangeDifferenceAccounting({...finance,staffSector:"operations"},transaction),
    {code:"forbidden"});
  await assert.rejects(service.exchangeDifferenceAccounting({id:requester,role:"customer"},transaction),
    {code:"forbidden"});
  await assert.rejects(service.exchangeDifferenceAccounting(finance,"invalid"),
    {code:"invalid_freight_settlement_id"});
});
