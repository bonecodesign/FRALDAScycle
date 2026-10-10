import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createLogisticsService} from '../apps/api/logistics-service.js';
const id='11111111-1111-4111-8111-111111111111';
test('courier details HTTP uses session identity and no-store; unrelated accounts cannot read',async context=>{
 const repository={async courierContact({courierId,shipmentId}){assert.equal(shipmentId,id);if(courierId!=='own')throw Object.assign(new Error('Contato indisponível'),{status:409,code:'logistics_contact_not_available'});return {displayName:'Pessoa fictícia',phone:'+5500000000000',purpose:'pickup'}},async courierPayoutStatus({actorId,shipmentId,reviewer}){assert.equal(shipmentId,id);assert.equal(reviewer,false);if(actorId!=='own')return null;return {kind:'sale',shipment_status:'assigned',delivery_fee_cents:null,financial_case_pending:false}}};
 const server=createApiServer({config:loadConfig({NODE_ENV:'test'}),authService:{async session(token){return token==='own'||token==='other'?{id:token,role:'courier'}:token==='buyer'?{id:'buyer',role:'customer'}:null}},logisticsService:createLogisticsService(repository,null,null)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));context.after(()=>server.close());
 const base=`http://127.0.0.1:${server.address().port}/v1/shipments/${id}`;
 for(const suffix of ['contact','courier-payout']){
  assert.equal((await fetch(base+'/'+suffix)).status,401);
  const other=await fetch(base+'/'+suffix,{headers:{cookie:'fc_session=other'}});assert.equal(other.status,suffix==='contact'?409:404);
  const own=await fetch(base+'/'+suffix+'?courierId=other',{headers:{cookie:'fc_session=own'}});assert.equal(own.status,200);assert.equal(own.headers.get('cache-control'),'no-store');
  const result=await own.json();if(suffix==='contact')assert.equal(result.contact.phone,'+5500000000000');else{assert.equal(result.payout.payoutAllowed,false);assert.equal(result.payout.freightCents,null);}
 }
 assert.equal((await fetch(base+'/contact',{headers:{cookie:'fc_session=buyer'}})).status,403);
 assert.equal((await fetch(base+'/courier-payout',{method:'POST',headers:{cookie:'fc_session=own','content-type':'application/json'},body:JSON.stringify({confirmed:true})})).status,403);
});
