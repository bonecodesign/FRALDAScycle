import assert from 'node:assert/strict';
import test from 'node:test';
import {createLogisticsService} from '../apps/api/logistics-service.js';
import {createLogisticsRepository} from '../database/logistics-repository.js';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';

test('courier query restricts account, active states and size without selecting private data',async()=>{
  const repository=createLogisticsRepository({async query(sql,params){assert.deepEqual(params,['own-courier']);assert.match(sql,/courier_id=\$1/);assert.match(sql,/status IN \('assigned','picked_up','in_transit'\)/);assert.match(sql,/LIMIT 50/);assert.doesNotMatch(sql,/buyer_id|seller_id|address|phone|amount|provider_reference/);return {rows:[]}}});
  assert.deepEqual(await repository.courierShipments('own-courier'),[]);
});
test('courier service rejects other roles and projects only operational metadata',async()=>{
  let calls=0;const service=createLogisticsService({async courierShipments(id){calls++;assert.equal(id,'own');return [{id:'shipment',status:'assigned',mode:'postal',insured:false,buyer_id:'secret',phone:'secret',provider_reference:'secret'}]}},null,null);
  for(const role of ['customer','moderator',undefined])await assert.rejects(service.courierShipments({id:'own',role}),error=>error.status===403);
  assert.equal(calls,0);const items=await service.courierShipments({id:'own',role:'courier'});assert.deepEqual(Object.keys(items[0]),['id','status','mode','insured','estimatedDeliveryAt']);
});
test('HTTP courier list uses authenticated identity and prevents cached operational data',async context=>{
  const service=createLogisticsService({async courierShipments(id){assert.equal(id,'own');return []}},null,null);
  const server=createApiServer({config:loadConfig({NODE_ENV:'test'}),authService:{async session(token){return token==='courier'?{id:'own',role:'courier'}:token==='buyer'?{id:'buyer',role:'customer'}:null}},logisticsService:service});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));context.after(()=>server.close());const url=`http://127.0.0.1:${server.address().port}/v1/courier/shipments?courierId=foreign`;
  assert.equal((await fetch(url)).status,401);assert.equal((await fetch(url,{headers:{cookie:'fc_session=buyer'}})).status,403);
  const result=await fetch(url,{headers:{cookie:'fc_session=courier'}});assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');assert.deepEqual((await result.json()).items,[]);
});
