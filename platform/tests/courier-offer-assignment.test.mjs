import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createLogisticsService } from '../apps/api/logistics-service.js';

const id='11111111-1111-4111-8111-111111111111',offer='22222222-2222-4222-8222-222222222222';
test('activation mode requires the current explicit courier offer',async()=>{let input;const service=createLogisticsService({acceptCourierOffer:async value=>{input=value;return{id,transaction_id:id,mode:'partner',insured:false,status:'assigned'};}},{},{},{courierOffersRequired:true});await assert.rejects(service.assign(id,id,{}),error=>error.code==='courier_offer_required');await service.assign(id,id,{offerId:offer,confirmed:true});assert.deepEqual(input,{courierId:id,shipmentId:id,offerId:offer});});
test('offer assignment rechecks complete eligibility and three-minute validity atomically',async()=>{const [schema,repository]=await Promise.all([readFile(new URL('../database/migrations/077_courier_delivery_offers.sql',import.meta.url),'utf8'),readFile(new URL('../database/logistics-repository.js',import.meta.url),'utf8')]);assert.match(schema,/expires_at=offered_at\+interval '3 minutes'/);for(const evidence of ['account_status=\'active\'','identity_status=\'verified\'','payout_status=\'verified\'','admin_approval_status=\'approved\'','courier_clearance_documents','courier_clearance_suspensions'])assert.match(repository,new RegExp(evidence));assert.match(repository,/shipment\.courier\.offer_accepted/);});
