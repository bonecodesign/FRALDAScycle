import assert from 'node:assert/strict';
import test from 'node:test';
import {createLogisticsService} from '../apps/api/logistics-service.js';
import {createLogisticsRepository} from '../database/logistics-repository.js';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';

test('courier query restricts account, active states and size without selecting private data',async()=>{
  const repository=createLogisticsRepository({async query(sql,params){assert.deepEqual(params,['own-courier',50,0]);assert.match(sql,/courier_id=\$1/);assert.match(sql,/status IN \('assigned','picked_up','in_transit'\)/);assert.match(sql,/LIMIT \$2 OFFSET \$3/);assert.doesNotMatch(sql,/buyer_id|seller_id|address|phone|amount|provider_reference/);return {rows:[]}}});
  assert.deepEqual(await repository.courierShipments('own-courier'),[]);
});
test('courier service rejects other roles and projects only operational metadata',async()=>{
  let calls=0;const service=createLogisticsService({async courierShipments(id){calls++;assert.equal(id,'own');return [{id:'shipment',status:'assigned',mode:'postal',insured:false,buyer_id:'secret',phone:'secret',provider_reference:'secret'}]}},null,null);
  for(const role of ['customer','moderator',undefined])await assert.rejects(service.courierShipments({id:'own',role}),error=>error.status===403);
  assert.equal(calls,0);const items=await service.courierShipments({id:'own',role:'courier'});assert.deepEqual(Object.keys(items[0]),['id','status','mode','insured','estimatedDeliveryAt']);
});
test('HTTP courier list uses authenticated identity and prevents cached operational data',async context=>{
  const service=createLogisticsService({async courierShipments(id){assert.equal(id,'own');return []},async courierHistory(id){assert.equal(id,'own');return []}},null,null);
  const server=createApiServer({config:loadConfig({NODE_ENV:'test'}),authService:{async session(token){return token==='courier'?{id:'own',role:'courier'}:token==='buyer'?{id:'buyer',role:'customer'}:null}},logisticsService:service});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));context.after(()=>server.close());const url=`http://127.0.0.1:${server.address().port}/v1/courier/shipments?courierId=foreign`;
  assert.equal((await fetch(url)).status,401);assert.equal((await fetch(url,{headers:{cookie:'fc_session=buyer'}})).status,403);
  const result=await fetch(url,{headers:{cookie:'fc_session=courier'}});assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');const data=await result.json();assert.deepEqual(data.items,[]);assert.equal(data.page,1);assert.equal(data.hasMore,false);assert.equal((await fetch(url+'&page=-1',{headers:{cookie:'fc_session=courier'}})).status,400);
  const history=url.replace('/shipments?','/history?');assert.equal((await fetch(history)).status,401);assert.equal((await fetch(history,{headers:{cookie:'fc_session=buyer'}})).status,403);const records=await fetch(history,{headers:{cookie:'fc_session=courier'}});assert.equal(records.status,200);assert.equal(records.headers.get('cache-control'),'no-store');assert.deepEqual((await records.json()).items,[]);
});

test('history limits results to the authenticated courier and finished operational states',async()=>{
 const repository=createLogisticsRepository({async query(sql,params){assert.deepEqual(params,['own',50,0]);assert.match(sql,/courier_id=\$1/);assert.match(sql,/status IN \('delivered','failed','cancelled'\)/);assert.match(sql,/ORDER BY updated_at DESC,id DESC LIMIT \$2 OFFSET \$3/);assert.doesNotMatch(sql,/address|phone|amount|provider_reference/);return {rows:[]}}});
 assert.deepEqual(await repository.courierHistory('own'),[]);
 const service=createLogisticsService({async courierHistory(actorId){assert.equal(actorId,'own');return [{id:'shipment',status:'delivered',mode:'postal',updated_at:'synthetic-date',phone:'private'}]}},null,null);
 await assert.rejects(service.courierHistory({id:'own',role:'customer'}),error=>error.status===403);
 assert.deepEqual(Object.keys((await service.courierHistory({id:'own',role:'courier'}))[0]),['id','status','mode','updatedAt']);
});

test('pagination requests 51 account-scoped rows, projects 50 and rejects invalid pages before reading',async()=>{
 let calls=0;const repository={async courierShipments(actor,options){calls++;assert.equal(actor,'own');assert.deepEqual(options,{limit:51,offset:50});return Array.from({length:51},(_,i)=>({id:String(i),status:'assigned',mode:'postal'}))}};
 const service=createLogisticsService(repository,null,null);const result=await service.courierPage({id:'own',role:'courier'},{page:'2'});assert.equal(result.page,2);assert.equal(result.items.length,50);assert.equal(result.hasMore,true);
 for(const page of ['0','-1','1.5','1e3','100001','injection'])await assert.rejects(service.courierPage({id:'own',role:'courier'},{page}),error=>error.status===400);
 assert.equal(calls,1);await assert.rejects(service.courierPage({id:'foreign',role:'customer'},{page:'2'}),error=>error.status===403);assert.equal(calls,1);
});
