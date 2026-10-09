import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createDonationService} from '../apps/api/donation-service.js';
import {createDonationRepository} from '../database/donation-repository.js';
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
test('institution refusal requires current version, explicit confirmation and a classified reason',()=>{
 const s=createDonationService({refuse(v){return v;}}),base={expectedVersion:1,confirmed:true,reason:'sanitary_condition',idempotencyKey:'synthetic-refusal-key'};
 assert.equal(s.refuse({id:'rep'},id,base).actorId,'rep');
 assert.throws(()=>s.refuse({id:'rep'},id,{...base,confirmed:false}),e=>e.status===422);
 assert.throws(()=>s.refuse({id:'rep'},id,{...base,expectedVersion:3}),e=>e.status===422);
 assert.throws(()=>s.refuse({id:'rep'},id,{...base,reason:'other',note:'curto'}),e=>e.status===422);
 assert.equal(s.refuse({id:'rep'},id,{...base,reason:'other',note:'Capacidade específica indisponível.'}).reason,'other');
 assert.equal(s.refuse({id:'rep'},id,{...base,evidenceKey:'private/donation-proof-01'}).evidenceKey,'private/donation-proof-01');
 assert.throws(()=>s.refuse({id:'rep'},id,{...base,evidenceKey:'https://public.example/photo'}),e=>e.status===422);
 assert.throws(()=>s.refuse({id:'rep'},id,{...base,donorId:'foreign'}),e=>e.status===422);
});
test('only an explicit version-three donor decision can relist or close',()=>{
 const s=createDonationService({decideAfterRefusal(v){return v;}}),base={expectedVersion:3,decision:'relist',confirmed:true,idempotencyKey:'synthetic-donor-decision'};
 assert.equal(s.decide({id:'donor'},id,base).actorId,'donor');
 assert.equal(s.decide({id:'donor'},id,{...base,decision:'close'}).decision,'close');
 assert.equal(s.decide({id:'donor'},id,{...base,decision:'redirect',targetInstitutionId:'22222222-2222-4222-8222-222222222222'}).decision,'redirect');
 for(const patch of [{confirmed:false},{expectedVersion:2},{decision:'automatic'},{idempotencyKey:'short'}])assert.throws(()=>s.decide({id:'donor'},id,{...base,...patch}),e=>e.status===422);
});
test('redirect requires a different active institution with a verified representative',async()=>{
 const target='22222222-2222-4222-8222-222222222222',operation={transaction_id:id,listing_id:'listing-1',institution_id:'institution-1',donor_id:'donor',representative_id:'old-rep',version:3,refused_at:'2026-10-08',refusal_reason:'institution_capacity'};const statements=[];
 const client={async query(text,values){statements.push({text,values});if(text.startsWith('SELECT * FROM donation_operations'))return{rows:[operation]};if(text.startsWith('SELECT id,status FROM transactions'))return{rows:[{id,status:'cancelled'}]};if(text.startsWith('SELECT id,seller_id,kind'))return{rows:[{id:'listing-1',seller_id:'donor',kind:'donation',status:'unavailable',institution_id:'institution-1',package_condition:'open'}]};if(text.includes('FROM institution_representatives'))return{rows:[{user_id:'new-rep'}]};if(text.startsWith('SELECT status,open_packages_accepted'))return{rows:[{status:'active',open_packages_accepted:true}]};if(text.startsWith('SELECT id FROM users'))return{rows:[{id:'donor'}]};if(text.includes('clock_timestamp() AS checked_at'))return{rows:[{checked_at:'2026-10-08T12:00:00Z',subscription:null}]};if(text.includes('AS suspended'))return{rows:[{suspended:false}]};if(text.includes('count(*)::integer AS count'))return{rows:[{count:1}]};if(text.startsWith('UPDATE donation_operations'))return{rows:[{...operation,version:4,donor_decision:'redirect',donor_decision_institution_id:target}]};return{rows:[]};}};
 const result=await createDonationRepository({async transaction(work){return work(client);}}).decideAfterRefusal({actorId:'donor',transactionId:id,expectedVersion:3,decision:'redirect',targetInstitutionId:target,idempotencyKey:'synthetic-donor-redirect'});
 assert.equal(result.listing_status,'published');const listingUpdate=statements.find(x=>x.text.startsWith('UPDATE listings SET status='));assert.equal(listingUpdate.values[2],target);assert.equal(result.institution_id,'institution-1');assert.ok(statements.some(x=>/donation\.donor\.redirected/.test(x.values?.[1]??'')));
});
test('donor can close a refused donation while preserving refusal fields and history',async()=>{
 const operation={transaction_id:id,listing_id:'listing-1',institution_id:'institution-1',donor_id:'donor',representative_id:'rep',version:3,refused_at:'2026-10-08',refusal_reason:'listing_mismatch'};const statements=[];
 const client={async query(text,values){statements.push({text,values});if(text.startsWith('SELECT * FROM donation_operations'))return{rows:[operation]};if(text.startsWith('SELECT id,status FROM transactions'))return{rows:[{id,status:'cancelled'}]};if(text.startsWith('SELECT id,seller_id,kind'))return{rows:[{id:'listing-1',seller_id:'donor',kind:'donation',status:'unavailable',institution_id:'institution-1',package_condition:'sealed'}]};if(text.startsWith('UPDATE donation_operations'))return{rows:[{...operation,version:4,donor_decision:'close',donor_decision_idempotency_key:'synthetic-donor-close'}]};return{rows:[]};}};
 const result=await createDonationRepository({async transaction(work){return work(client);}}).decideAfterRefusal({actorId:'donor',transactionId:id,expectedVersion:3,decision:'close',idempotencyKey:'synthetic-donor-close'});
 assert.equal(result.listing_status,'removed');assert.equal(result.refusal_reason,'listing_mismatch');assert.ok(statements.some(x=>/status=\$2::listing_status/.test(x.text)&&x.values[1]==='removed'));assert.ok(statements.some(x=>/donation\.donor\.closed/.test(x.values?.[1]??'')));
});
test('relisting revalidates institution, account moderation and free publication capacity',async()=>{
 const operation={transaction_id:id,listing_id:'listing-1',institution_id:'institution-1',donor_id:'donor',representative_id:'rep',version:3,refused_at:'2026-10-08',refusal_reason:'institution_capacity'};const statements=[];
 const client={async query(text,values){statements.push({text,values});if(text.startsWith('SELECT * FROM donation_operations'))return{rows:[operation]};if(text.startsWith('SELECT id,status FROM transactions'))return{rows:[{id,status:'cancelled'}]};if(text.startsWith('SELECT id,seller_id,kind'))return{rows:[{id:'listing-1',seller_id:'donor',kind:'donation',status:'unavailable',institution_id:'institution-1',package_condition:'sealed'}]};if(text.startsWith('SELECT status,open_packages_accepted'))return{rows:[{status:'active',open_packages_accepted:true}]};if(text.startsWith('SELECT id FROM users'))return{rows:[{id:'donor'}]};if(text.includes('clock_timestamp() AS checked_at'))return{rows:[{checked_at:'2026-10-08T12:00:00Z',subscription:null}]};if(text.includes('AS suspended'))return{rows:[{suspended:false}]};if(text.includes('count(*)::integer AS count'))return{rows:[{count:2}]};if(text.startsWith('UPDATE donation_operations'))return{rows:[{...operation,version:4,donor_decision:'relist'}]};return{rows:[]};}};
 const result=await createDonationRepository({async transaction(work){return work(client);}}).decideAfterRefusal({actorId:'donor',transactionId:id,expectedVersion:3,decision:'relist',idempotencyKey:'synthetic-donor-relist'});
 assert.equal(result.listing_status,'published');assert.ok(statements.some(x=>x.text.startsWith('SELECT status,open_packages_accepted')));assert.ok(statements.some(x=>/donation\.donor\.relisted/.test(x.values?.[1]??'')));
});
test('institution refusal cancels donation and pre-collection shipment in one audited transaction',async()=>{
 const statements=[];
 const operation={transaction_id:id,listing_id:'listing-1',institution_id:'institution-1',donor_id:'donor-1',representative_id:'rep',version:2,refusal_idempotency_key:null};
 const client={async query(text,values){statements.push({text,values});
  if(text.startsWith('SELECT id,status FROM transactions'))return{rows:[{id,status:'donation_confirmed'}]};
  if(text.startsWith('SELECT * FROM donation_operations'))return{rows:[operation]};
  if(text.startsWith('SELECT id,status FROM institutions'))return{rows:[{id:'institution-1',status:'active'}]};
  if(text.includes('FROM institution_representatives'))return{rows:[{user_id:'rep'}]};
  if(text.startsWith('SELECT id,status FROM shipments'))return{rows:[{id:'shipment-1',status:'assigned'}]};
  if(text.startsWith('UPDATE donation_operations'))return{rows:[{...operation,version:3,refused_by:'rep',refusal_reason:'listing_mismatch'}]};
  return{rows:[]};
 }};
 const database={async transaction(work){return work(client);},async query(){return{rows:[]};}};
 const result=await createDonationRepository(database).refuse({actorId:'rep',transactionId:id,expectedVersion:2,reason:'listing_mismatch',note:null,evidenceKey:null,idempotencyKey:'synthetic-refusal-key'});
 assert.equal(result.transaction_status,'cancelled');assert.equal(result.version,3);assert.equal(result.reused,false);
 assert.ok(statements.some(item=>/UPDATE transactions SET status='cancelled'/.test(item.text)));
 assert.ok(statements.some(item=>/UPDATE shipments SET status='cancelled'/.test(item.text)));
 assert.ok(statements.some(item=>/donation\.institution\.refused/.test(item.values?.[1]??'')));
 assert.ok(!statements.some(item=>/UPDATE listings/.test(item.text)));
});
test('institution refusal routes collected donation to support without writes',async()=>{
 const statements=[];
 const client={async query(text,values){statements.push({text,values});
  if(text.startsWith('SELECT id,status FROM transactions'))return{rows:[{id,status:'donation_confirmed'}]};
  if(text.startsWith('SELECT * FROM donation_operations'))return{rows:[{transaction_id:id,institution_id:'institution-1',representative_id:'rep',version:2}]};
  if(text.startsWith('SELECT id,status FROM institutions'))return{rows:[{id:'institution-1',status:'active'}]};
  if(text.includes('FROM institution_representatives'))return{rows:[{user_id:'rep'}]};
  if(text.startsWith('SELECT id,status FROM shipments'))return{rows:[{id:'shipment-1',status:'picked_up'}]};
  return{rows:[]};
 }};
 const repository=createDonationRepository({async transaction(work){return work(client);}});
 await assert.rejects(repository.refuse({actorId:'rep',transactionId:id,expectedVersion:2,reason:'listing_mismatch',note:null,evidenceKey:null,idempotencyKey:'synthetic-refusal-key'}),e=>e.code==='donation_refusal_support_required');
 assert.ok(!statements.some(item=>item.text.startsWith('UPDATE donation_operations')));
});
test('donation interface exposes classified refusal without promising automatic relisting',async()=>{
 const [handler,ui]=await Promise.all([readFile(new URL('../apps/api/donation-handler.js',import.meta.url),'utf8'),readFile(new URL('../apps/app/donations.js',import.meta.url),'utf8')]);
 assert.match(handler,/accept\|refuse\|decide\|pickup/);
 for(const reason of ['sanitary_condition','outside_scope','insufficient_expiry','institution_capacity','listing_mismatch','other'])assert.match(ui,new RegExp(`value="${reason}"`));
 assert.match(ui,/selected\.transaction_id\+'\/refuse/);
 assert.match(ui,/O anúncio permanece indisponível/);
 assert.match(ui,/Redirecionar para outra instituição/);
 assert.match(ui,/name="confirmed" type="checkbox" required/);
});
test('institution approval and independent proof validation never authorize courier payout',()=>{
 const row={kind:'donation',donation_authorized:true,shipment_status:'delivered',id:'proof',transaction_status:'in_delivery',approved_at:'2026-01-01',validated_at:'2026-01-01',financial_case_pending:false};
 const ready=institutionReceiptReadiness(row);assert.equal(ready.operationalRequirementsMet,true);assert.equal(ready.requirementsMet,false);assert.equal(ready.payoutAllowed,false);
 for(const changed of [{donation_authorized:false},{approved_at:null},{validated_at:'invalid'},{financial_case_pending:true}])assert.equal(institutionReceiptReadiness({...row,...changed}).operationalRequirementsMet,false);
});
