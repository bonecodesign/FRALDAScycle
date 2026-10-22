import assert from 'node:assert/strict';
import {createAddressChangeService} from '../apps/api/address-change-service.js';
export async function validateSyntheticAddressChange(database,{service,repository,user,other,admin,shipment,address}){
  const changes=createAddressChangeService(repository.addressChanges);
  const shares=await service.sharedAddresses(user,shipment.id),share=shares[0];
  const next=await service.createAddress(user,{label:'Outro endereço fictício',postalCode:'00000000',street:'Rua alternativa fictícia',number:'S/N',district:'Bairro fictício',city:'Belo Horizonte',state:'MG'});
  const input={shareId:share.id,addressId:next.id,expectedRevision:0,confirmed:true,noticeVersion:'FC-ADDRESS-1',reason:'Correção solicitada somente em fixture fictícia.',idempotencyKey:'synthetic-address-change-primary'};
  await assert.rejects(changes.request({id:other,role:'customer'},input),e=>e.status===404);
  await assert.rejects(changes.request({id:user,role:'customer'},{...input,addressId:'10000000-0000-4000-8000-000000000099'}),e=>e.status===404);
  const requests=await Promise.all([changes.request({id:user,role:'customer'},input),changes.request({id:user,role:'customer'},input)]);
  assert.equal(requests.filter(x=>!x.reused).length,1);assert.equal(requests[0].id,requests[1].id);
  assert.equal((await service.sharedAddresses(other,shipment.id))[0].address_snapshot.street,address.street);
  await assert.rejects(changes.detail({id:other,role:'customer'},requests[0].id),e=>e.status===404);
  const adminActor={id:admin,role:'admin'};
  assert.equal((await changes.detail(adminActor,requests[0].id)).requested_snapshot.street,next.street);
  assert.throws(()=>changes.review({id:other,role:'customer'},requests[0].id,{}),e=>e.status===403);
  const review={confirmed:true,outcome:'approved',reason:'Conferência sintética do titular, consentimento e retirada.'};
  await assert.rejects(changes.review({id:user,role:'admin'},requests[0].id,review),e=>e.code==='independent_address_review_required');
  await assert.rejects(changes.review(adminActor,requests[0].id,review),e=>e.code==='address_provider_update_not_configured'&&e.status===409);
  await changes.review(adminActor,requests[0].id,{...review,outcome:'rejected',reason:'Alteração rejeitada até a homologação do fornecedor de entrega.'});
  const unchanged=(await service.sharedAddresses(other,shipment.id))[0];assert.equal(unchanged.revision,0);assert.equal(unchanged.address_snapshot.street,address.street);assert.equal(String(unchanged.shared_at),String(share.shared_at));
  assert.equal((await database.query('SELECT count(*)::int AS count FROM shipment_address_revisions WHERE share_id=$1',[share.id])).rows[0].count,0);
  assert.equal((await changes.request({id:user,role:'customer'},input)).reused,true);
  await assert.rejects(changes.request({id:user,role:'customer'},{...input,reason:'Motivo diferente em uma repetição.'}),e=>e.code==='address_change_idempotency_conflict');
  const audit=await database.query('SELECT metadata FROM audit_events');assert.equal(JSON.stringify(audit.rows).includes(next.street),false);
  console.log('BETA_ADDRESS_CHANGE: protocolo, consentimento, isolamento, revisão independente e bloqueio seguro até homologação do fornecedor preservados em PostgreSQL.');
}
