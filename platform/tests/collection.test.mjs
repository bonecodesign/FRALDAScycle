import assert from 'node:assert/strict';
import test from 'node:test';
import {createLogisticsService} from '../apps/api/logistics-service.js';
import {createLogisticsRepository} from '../database/logistics-repository.js';
test('collection requires explicit versioned confirmation and does not accept another courier identity',async()=>{
 const service=createLogisticsService({collect(){assert.fail('Must not record invalid collection');}},null,null);
 for(const input of [{confirmed:false,noticeVersion:'FC-COLLECTION-1'},{confirmed:true,noticeVersion:'old'},{confirmed:true,noticeVersion:'FC-COLLECTION-1',courierId:'foreign'}])await assert.rejects(service.collect('own','shipment',input),e=>e.code==='explicit_collection_required');
});
test('unassigned courier cannot acquire shipment metadata or record collection',async()=>{
 let calls=0;const repository=createLogisticsRepository({async transaction(fn){return fn({async query(){calls++;return {rows:[]};}});}});
 await assert.rejects(repository.collect({courierId:'foreign',shipmentId:'shipment'}),e=>e.code==='shipment_not_assigned'&&e.status===403);assert.equal(calls,1);
});
