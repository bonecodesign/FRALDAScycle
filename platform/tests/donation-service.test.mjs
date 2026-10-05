import assert from 'node:assert/strict';
import test from 'node:test';
import {createDonationService} from '../apps/api/donation-service.js';
import {institutionReceiptReadiness} from '../packages/contracts/institution-receipt-readiness.js';
const id='11111111-1111-4111-8111-111111111111',consent={confirmed:true,noticeVersion:'FC-DONATION-1',logisticsResponsibility:'donor'};
test('donation binds donor and requires both explicit notice and approved logistics responsibility',()=>{
 const s=createDonationService({create(v){return v;}}),input={...consent,listingId:id,idempotencyKey:'synthetic-donation-key'};
 assert.throws(()=>s.create({id:'own'},{...input,logisticsResponsibility:'institution'}),e=>e.status===422);
 assert.throws(()=>s.create({id:'own'},{...input,donorId:'foreign'}),e=>e.status===422);
 assert.equal(s.create({id:'own'},input).actorId,'own');
});
test('institution confirmation has a fixed initial version and does not accept a shipment provider',()=>{
 const s=createDonationService({accept(v){return v;},pickup(v){return v;}});
 assert.throws(()=>s.accept({id:'rep'},id,{...consent,expectedVersion:2}),e=>e.status===422);
 assert.equal(s.accept({id:'rep'},id,{...consent,expectedVersion:1}).actorId,'rep');
 assert.throws(()=>s.pickup({id:'own'},id,{...consent,idempotencyKey:'synthetic-donation-pickup',mode:'partner'}),e=>e.status===422);
});
test('institution approval and independent proof validation never authorize courier payout',()=>{
 const row={kind:'donation',donation_authorized:true,shipment_status:'delivered',id:'proof',transaction_status:'in_delivery',approved_at:'2026-01-01',validated_at:'2026-01-01',financial_case_pending:false};
 const ready=institutionReceiptReadiness(row);assert.equal(ready.operationalRequirementsMet,true);assert.equal(ready.requirementsMet,false);assert.equal(ready.payoutAllowed,false);
 for(const changed of [{donation_authorized:false},{approved_at:null},{validated_at:'invalid'},{financial_case_pending:true}])assert.equal(institutionReceiptReadiness({...row,...changed}).operationalRequirementsMet,false);
});
