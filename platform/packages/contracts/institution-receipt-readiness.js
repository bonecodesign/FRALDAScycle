export function institutionReceiptReadiness(row,now=Date.now()){
 const blockers=[];
 if(row.kind!=='donation')blockers.push('unsupported_transaction_kind');
 if(row.donation_authorized!==true)blockers.push('institution_authority_pending');
 if(row.shipment_status!=='delivered'||!row.id)blockers.push('delivery_proof_pending');
 if(row.transaction_status!=='in_delivery')blockers.push('transaction_not_eligible');
 const approval=row.approved_at==null?NaN:new Date(row.approved_at).getTime(),validation=row.validated_at==null?NaN:new Date(row.validated_at).getTime();
 if(!Number.isFinite(approval)||approval>now)blockers.push('institution_approval_pending');
 if(!Number.isFinite(validation)||validation>now)blockers.push('independent_proof_validation_pending');
 if(row.financial_case_pending!==false)blockers.push('operational_issue_pending');
 return {operationalRequirementsMet:blockers.length===0,requirementsMet:false,blockers:[...blockers,'donor_logistics_payment_not_homologated','courier_payout_not_configured'],logisticsResponsibility:'donor',payoutAllowed:false,payoutStatus:'not_configured'};
}
