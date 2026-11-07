import {exchangeFee} from "./commercial-rules.js";
import {exchangeDifference} from "./exchange-difference.js";

const validValue=value=>Number.isSafeInteger(value)&&value>0&&value<=100_000_000;

// Read-only accounting: verifies independent 2.5% obligations and the
// directional difference. It neither acknowledges provider funds nor combines
// participant liabilities into a collectible checkout.
export function exchangeDifferenceAccounting({operation,feeRows=[],differenceRow=null}={}) {
  const blockers=[];
  if (!operation?.transaction_id || !operation.requester_id || !operation.owner_id
    || operation.requester_id===operation.owner_id) {
    throw new RangeError("Invalid exchange accounting context");
  }
  const requester=operation.requester_id,owner=operation.owner_id;
  if (!["accepted","in_delivery","completed"].includes(operation.status)) {
    blockers.push("exchange_not_accepted");
  }
  const valuesValid=validValue(operation.requester_declared_value_cents)
    &&validValue(operation.owner_declared_value_cents);
  if (!valuesValid) blockers.push("exchange_declared_values_invalid");
  let expectedDifference=null;
  if (valuesValid) {
    expectedDifference=exchangeDifference({
      requesterId:requester,ownerId:owner,
      requesterDeclaredValueCents:operation.requester_declared_value_cents,
      ownerDeclaredValueCents:operation.owner_declared_value_cents,
    });
  }
  if (!Array.isArray(feeRows)||feeRows.length!==2) blockers.push("exchange_fee_cardinality_invalid");
  const expected=[
    {participantId:requester,listingId:operation.offered_listing_id,
      value:operation.requester_declared_value_cents},
    {participantId:owner,listingId:operation.requested_listing_id,
      value:operation.owner_declared_value_cents},
  ];
  const fees=expected.map(person=>{
    const rows=Array.isArray(feeRows)
      ?feeRows.filter(row=>row.participant_id===person.participantId):[];
    const row=rows[0]??null;
    const amountValid=validValue(person.value);
    const expectedCents=amountValid?exchangeFee(person.value):null;
    if (rows.length!==1||!row||!amountValid
      ||row.transaction_id!==operation.transaction_id
      ||row.offered_listing_id!==person.listingId
      ||row.declared_value_cents!==person.value
      ||row.fee_basis_points!==250
      ||row.fee_cents!==expectedCents) blockers.push("exchange_fee_snapshot_mismatch");
    return Object.freeze({
      participantId:person.participantId,
      declaredValueCents:amountValid?person.value:null,
      feeCents:expectedCents,
      recordedStatus:row?.status??null,
    });
  });
  if (Array.isArray(feeRows) && feeRows.some(row=>
    ![requester,owner].includes(row.participant_id))) blockers.push("exchange_fee_participant_invalid");
  if (valuesValid) {
    if (!expectedDifference && differenceRow) blockers.push("exchange_difference_unexpected");
    if (expectedDifference && !differenceRow) blockers.push("exchange_difference_missing");
    if (expectedDifference && differenceRow && (
      differenceRow.transaction_id!==operation.transaction_id
      ||differenceRow.payer_id!==expectedDifference.payerId
      ||differenceRow.recipient_id!==expectedDifference.recipientId
      ||differenceRow.lower_value_cents!==expectedDifference.lowerValueCents
      ||differenceRow.higher_value_cents!==expectedDifference.higherValueCents
      ||differenceRow.amount_cents!==expectedDifference.amountCents
    )) blockers.push("exchange_difference_snapshot_mismatch");
  } else if (differenceRow) blockers.push("exchange_difference_unverifiable");
  const localConsistent=blockers.length===0;
  const participantObligations=fees.map(fee=>{
    const differenceToPayCents=expectedDifference?.payerId===fee.participantId
      ?expectedDifference.amountCents:0;
    const feeCents=localConsistent?fee.feeCents:null;
    return Object.freeze({
      ...fee,
      differenceToPayCents:localConsistent?differenceToPayCents:null,
      combinedLocalObligationCents:localConsistent?feeCents+differenceToPayCents:null,
      providerProcessingFeeCents:null,
      externalChargeCreated:false,
    });
  });
  return Object.freeze({
    transactionId:operation.transaction_id,
    localConsistent,
    participants:Object.freeze(participantObligations),
    difference:expectedDifference?Object.freeze({
      payerId:expectedDifference.payerId,
      recipientId:expectedDifference.recipientId,
      amountCents:expectedDifference.amountCents,
      recordedStatus:differenceRow?.status??null,
    }):null,
    blockers:Object.freeze([...new Set(blockers)]),
    processingFeeHomologated:false,
    providerReconciled:false,
    externalChargeCreated:false,
    payoutAllowed:false,
  });
}
