import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createExchangeService} from '../apps/api/exchange-service.js';
import {createDatabase} from '../database/client.js';
import {createExchangeRepository} from '../database/exchange-repository.js';
import {createLogisticsService} from '../apps/api/logistics-service.js';
import {createLogisticsRepository} from '../database/logistics-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const ids={requester:'11111111-1111-4111-8111-111111111111',owner:'22222222-2222-4222-8222-222222222222',admin:'33333333-3333-4333-8333-333333333333',courier1:'44444444-4444-4444-8444-444444444444',courier2:'55555555-5555-4555-8555-555555555555'};
const listingIds=[
 '61111111-1111-4111-8111-111111111111','62222222-2222-4222-8222-222222222222',
 '63333333-3333-4333-8333-333333333333','64444444-4444-4444-8444-444444444444',
 '65555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666',
];

test('exchange refusal, bilateral cancellation and completion cross HTTP and PostgreSQL',{
 skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{
  const database=createDatabase({databaseUrl,databaseSsl:false});let api;
  try{
   await migrate(database,await discoverMigrations());
   await database.query(`INSERT INTO users(id,email,password_hash,display_name,role,email_verified_at) VALUES
    ($1,'exchange-requester@example.test','fixture','Solicitante fictício','customer',now()),
    ($2,'exchange-owner@example.test','fixture','Titular fictício','customer',now()),
    ($3,'exchange-admin@example.test','fixture','Admin fictício','admin',now()),
    ($4,'exchange-courier-1@example.test','fixture','Entregador fictício 1','courier',now()),
    ($5,'exchange-courier-2@example.test','fixture','Entregador fictício 2','courier',now())`,Object.values(ids));
   for(let index=0;index<listingIds.length;index++)await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,open_package_attested,size,quantity,kind,status,city,state,published_at)
    VALUES($1,$2,$3,'Pacote fictício lacrado para prova integrada.','infant','Marca fictícia','Modelo fictício','sealed',false,'M',1,'exchange','published','Belo Horizonte','MG',now())`,[listingIds[index],index%2===0?ids.owner:ids.requester,`Troca fictícia ${index+1}`]);
   const actors={requester:{id:ids.requester,role:'customer'},owner:{id:ids.owner,role:'customer'},admin:{id:ids.admin,role:'admin'},courier1:{id:ids.courier1,role:'courier'},courier2:{id:ids.courier2,role:'courier'}};
   const exchangeService=createExchangeService(createExchangeRepository(database));
   const logisticsService=createLogisticsService(createLogisticsRepository(database));
   api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),exchangeService,logisticsService,authService:{async session(token){return actors[token]??null;}}});
   await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
   const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({cookie:`fc_session=${token}`,'content-type':'application/json'});
   async function propose(pair){const response=await fetch(`${origin}/v1/exchanges`,{method:'POST',headers:headers('requester'),body:JSON.stringify({requestedListingId:pair[0],offeredListingId:pair[1],confirmed:true})});const body=await response.json();assert.equal(response.status,201,JSON.stringify(body));return body.exchange.transaction_id;}
   const refusedId=await propose(listingIds.slice(0,2));
   const refusedResponse=await fetch(`${origin}/v1/exchanges/${refusedId}/refuse`,{method:'POST',headers:headers('owner'),body:JSON.stringify({expectedVersion:1,reason:'Os itens fictícios não atendem à necessidade atual.',confirmed:true})});const refused=await refusedResponse.json();assert.equal(refusedResponse.status,201,JSON.stringify(refused));assert.equal(refused.exchange.status,'refused');assert.equal((await database.query('SELECT status FROM transactions WHERE id=$1',[refusedId])).rows[0].status,'cancelled');
   const cancelledId=await propose(listingIds.slice(2,4));
   const acceptedCancel=await fetch(`${origin}/v1/exchanges/${cancelledId}/accept`,{method:'POST',headers:headers('owner'),body:JSON.stringify({expectedVersion:1,confirmed:true})});assert.equal(acceptedCancel.status,201);
   const reason='Ambas as partes fictícias decidiram cancelar antes da coleta.';
   const firstCancel=await fetch(`${origin}/v1/exchanges/${cancelledId}/cancel`,{method:'POST',headers:headers('requester'),body:JSON.stringify({expectedVersion:2,reason,confirmed:true})});assert.equal(firstCancel.status,201);assert.equal((await firstCancel.json()).exchange.counterpartConfirmed,false);
   const secondCancel=await fetch(`${origin}/v1/exchanges/${cancelledId}/cancel`,{method:'POST',headers:headers('owner'),body:JSON.stringify({expectedVersion:2,reason,confirmed:true})});const cancelled=await secondCancel.json();assert.equal(secondCancel.status,201,JSON.stringify(cancelled));assert.equal(cancelled.exchange.status,'cancelled');assert.equal(cancelled.exchange.counterpartConfirmed,true);
   assert.equal((await database.query("SELECT count(*)::int AS count FROM listings WHERE id=ANY($1::uuid[]) AND status='published'",[listingIds.slice(2,4)])).rows[0].count,2);
   assert.equal((await database.query("SELECT count(*)::int AS count FROM shipments WHERE transaction_id=$1 AND status='cancelled'",[cancelledId])).rows[0].count,2);
   const completedId=await propose(listingIds.slice(4,6));
   const acceptedComplete=await fetch(`${origin}/v1/exchanges/${completedId}/accept`,{method:'POST',headers:headers('owner'),body:JSON.stringify({expectedVersion:1,confirmed:true})});assert.equal(acceptedComplete.status,201);
   const acceptedBody=await acceptedComplete.json();
   assert.deepEqual(acceptedBody.exchange.shipments.map(leg=>({leg:leg.exchange_leg,sender:leg.seller_id,receiver:leg.buyer_id,payer:leg.logistics_payer_id})),[
    {leg:1,sender:ids.requester,receiver:ids.owner,payer:ids.owner},
    {leg:2,sender:ids.owner,receiver:ids.requester,payer:ids.requester},
   ]);
   const detailResponse=await fetch(`${origin}/v1/exchanges/${completedId}`,{headers:headers('requester')});const detail=await detailResponse.json();assert.equal(detailResponse.status,200,JSON.stringify(detail));
   assert.deepEqual(detail.exchange.legs.map(leg=>({leg:leg.leg,sender:leg.senderId,receiver:leg.receiverId,payer:leg.logisticsPayerId})),[
    {leg:1,sender:ids.requester,receiver:ids.owner,payer:ids.owner},
    {leg:2,sender:ids.owner,receiver:ids.requester,payer:ids.requester},
   ]);
   await assert.rejects(database.query('UPDATE shipments SET logistics_payer_id=seller_id WHERE transaction_id=$1 AND exchange_leg=1',[completedId]),error=>error.code==='23514');
   const legs=(await database.query('SELECT id,exchange_leg,buyer_id FROM shipments WHERE transaction_id=$1 ORDER BY exchange_leg',[completedId])).rows;
   for(const [index,leg] of legs.entries()){
    const courier=index===0?ids.courier1:ids.courier2;
    const assignmentUrl=`${origin}/v1/shipments/${leg.id}/assign`;
    assert.equal((await fetch(assignmentUrl,{method:'POST',headers:headers('admin')})).status,403);
    if(index===0){
     await database.query("UPDATE transactions SET status='disputed' WHERE id=$1",[completedId]);
     assert.equal((await fetch(assignmentUrl,{method:'POST',headers:headers('courier1')})).status,409);
     await database.query("UPDATE transactions SET status='in_delivery' WHERE id=$1",[completedId]);
     await database.query('UPDATE users SET disabled_at=now() WHERE id=$1',[courier]);
     assert.equal((await fetch(assignmentUrl,{method:'POST',headers:headers('courier1')})).status,409);
     await database.query('UPDATE users SET disabled_at=NULL WHERE id=$1',[courier]);
    }
    const assigned=await fetch(assignmentUrl,{method:'POST',headers:headers(index===0?'courier1':'courier2')});
    assert.equal(assigned.status,200,JSON.stringify(await assigned.clone().json()));
    assert.equal((await fetch(assignmentUrl,{method:'POST',headers:headers(index===0?'courier2':'courier1')})).status,409);
    await database.query("UPDATE shipments SET status='delivered' WHERE id=$1 AND courier_id=$2",[leg.id,courier]);
    const proof=(await database.query("INSERT INTO delivery_proofs(shipment_id,courier_id,media_key,recipient_name,latitude,longitude) VALUES($1,$2,$3,'Recebedor fictício',-19.9167,-43.9345) RETURNING id",[leg.id,courier,`private/exchange-proof-${index+1}`])).rows[0];
    await database.query('INSERT INTO delivery_receipt_approvals(proof_id,approver_id) VALUES($1,$2)',[proof.id,leg.buyer_id]);
    await database.query('INSERT INTO delivery_proof_validations(proof_id,validator_id,reason) VALUES($1,$2,$3)',[proof.id,ids.admin,'Comprovante fictício validado independentemente.']);
   }
   const assignedLegs=(await database.query('SELECT exchange_leg,courier_id FROM shipments WHERE transaction_id=$1 ORDER BY exchange_leg',[completedId])).rows;
   assert.deepEqual(assignedLegs.map(leg=>leg.courier_id),[ids.courier1,ids.courier2]);
   for(const [index,leg] of legs.entries()){
    const payoutUrl=`${origin}/v1/shipments/${leg.id}/courier-payout`,owner=index===0?'courier1':'courier2',otherCourier=index===0?'courier2':'courier1';
    assert.equal((await fetch(payoutUrl,{headers:headers(otherCourier)})).status,404);
    const response=await fetch(payoutUrl,{headers:headers(owner)}),body=await response.json();
    assert.equal(response.status,200,JSON.stringify(body));
    assert.equal(body.payout.eligible,false);
    assert.deepEqual(body.payout.blockers,['exchange_freight_not_configured']);
    assert.deepEqual([body.payout.freightCents,body.payout.platformFeeCents,body.payout.courierAmountCents],[null,null,null]);
    assert.equal(body.payout.payoutAllowed,false);
   }
   const unauthorized=await fetch(`${origin}/v1/exchanges/${completedId}/complete`,{method:'POST',headers:headers('requester'),body:JSON.stringify({confirmed:true})});assert.equal(unauthorized.status,403);
   const completeResponse=await fetch(`${origin}/v1/exchanges/${completedId}/complete`,{method:'POST',headers:headers('admin'),body:JSON.stringify({confirmed:true})});const completed=await completeResponse.json();assert.equal(completeResponse.status,201,JSON.stringify(completed));assert.equal(completed.exchange.status,'completed');
   assert.equal((await database.query('SELECT status FROM transactions WHERE id=$1',[completedId])).rows[0].status,'completed');
   assert.equal((await database.query("SELECT count(*)::int AS count FROM listings WHERE id=ANY($1::uuid[]) AND status='completed'",[listingIds.slice(4,6)])).rows[0].count,2);
   assert.equal((await database.query('SELECT count(*)::int AS count FROM payment_intents WHERE transaction_id=$1',[completedId])).rows[0].count,0);
   const audit=(await database.query("SELECT action FROM audit_events WHERE entity_id=ANY($1::text[]) AND action IN('exchange.refused','exchange.cancelled_bilateral','exchange.completed') ORDER BY action",[[refusedId,cancelledId,completedId]])).rows.map(row=>row.action);assert.deepEqual(audit,['exchange.cancelled_bilateral','exchange.completed','exchange.refused']);
  }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
 });
});
