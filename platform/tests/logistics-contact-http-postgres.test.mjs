import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createLogisticsService} from '../apps/api/logistics-service.js';
import {createDatabase} from '../database/client.js';
import {createLogisticsRepository} from '../database/logistics-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const ids={seller:'11111111-1111-4111-8111-111111111111',buyer:'22222222-2222-4222-8222-222222222222',courier:'33333333-3333-4333-8333-333333333333',otherCourier:'44444444-4444-4444-8444-444444444444',admin:'55555555-5555-4555-8555-555555555555',listing:'66666666-6666-4666-8666-666666666666',transaction:'77777777-7777-4777-8777-777777777777',shipment:'88888888-8888-4888-8888-888888888888'};

test('assigned courier contact is stage-bound, audited and private over HTTP and PostgreSQL',{
 skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{
  const database=createDatabase({databaseUrl,databaseSsl:false});let api;
  try{
   await migrate(database,await discoverMigrations());
   await database.query(`INSERT INTO users(id,email,phone,password_hash,display_name,role,email_verified_at,phone_verified_at) VALUES
    ($1,'contact-seller@example.test','+5531999990001','fixture','Vendedor fictício','customer',now(),now()),
    ($2,'contact-buyer@example.test','+5531999990002','fixture','Comprador fictício','customer',now(),now()),
    ($3,'contact-courier@example.test','+5531999990003','fixture','Entregador atribuído','courier',now(),now()),
    ($4,'contact-other-courier@example.test','+5531999990004','fixture','Outro entregador','courier',now(),now()),
    ($5,'contact-admin@example.test','+5531999990005','fixture','Admin fictício','admin',now(),now())`,[ids.seller,ids.buyer,ids.courier,ids.otherCourier,ids.admin]);
   await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,open_package_attested,size,quantity,kind,price_cents,status,city,state,published_at)
    VALUES($1,$2,'Venda fictícia','Pacote fictício para contato logístico.','infant','Marca fictícia','Modelo fictício','sealed',false,'M',1,'sale',10000,'unavailable','Belo Horizonte','MG',now())`,[ids.listing,ids.seller]);
   await database.query("INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents) VALUES($1,$2,$3,$4,'paid',10000)",[ids.transaction,ids.listing,ids.buyer,ids.seller]);
   await database.query("INSERT INTO shipments(id,transaction_id,buyer_id,seller_id,courier_id,mode,insured,idempotency_key,status) VALUES($1,$2,$3,$4,$5,'partner',false,'contact-http-postgres-fixture','assigned')",[ids.shipment,ids.transaction,ids.buyer,ids.seller,ids.courier]);
   const actors={courier:{id:ids.courier,role:'courier'},other:{id:ids.otherCourier,role:'courier'},admin:{id:ids.admin,role:'admin'},buyer:{id:ids.buyer,role:'customer'}};
   const logisticsService=createLogisticsService(createLogisticsRepository(database));
   api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),logisticsService,authService:{async session(token){return actors[token]??null;}}});
   await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
   const origin=`http://127.0.0.1:${api.address().port}`,url=`${origin}/v1/shipments/${ids.shipment}/contact`,headers=token=>({cookie:`fc_session=${token}`});
   const buyerAttempt=await fetch(url,{headers:headers('buyer')});assert.equal(buyerAttempt.status,403);
   const adminAttempt=await fetch(url,{headers:headers('admin')});assert.equal(adminAttempt.status,403);
   const otherAttempt=await fetch(url,{headers:headers('other')});assert.equal(otherAttempt.status,409);assert.equal((await otherAttempt.json()).error.code,'logistics_contact_not_available');
   const pickupResponse=await fetch(url,{headers:headers('courier')});const pickup=await pickupResponse.json();assert.equal(pickupResponse.status,200,JSON.stringify(pickup));assert.equal(pickupResponse.headers.get('cache-control'),'no-store');assert.deepEqual(pickup.contact,{displayName:'Vendedor fictício',phone:'+5531999990001',purpose:'pickup'});
   await database.query("UPDATE shipments SET status='picked_up' WHERE id=$1",[ids.shipment]);
   await database.query("UPDATE transactions SET status='in_delivery' WHERE id=$1",[ids.transaction]);
   const deliveryResponse=await fetch(url,{headers:headers('courier')});const delivery=await deliveryResponse.json();assert.equal(deliveryResponse.status,200,JSON.stringify(delivery));assert.deepEqual(delivery.contact,{displayName:'Comprador fictício',phone:'+5531999990002',purpose:'delivery'});
   await database.query("UPDATE shipments SET status='delivered' WHERE id=$1",[ids.shipment]);
   const finished=await fetch(url,{headers:headers('courier')});assert.equal(finished.status,409);assert.equal((await finished.json()).error.code,'logistics_contact_not_available');
   const audit=(await database.query("SELECT metadata FROM audit_events WHERE entity_type='shipment' AND entity_id=$1 AND action='shipment.contact.read' ORDER BY id",[ids.shipment])).rows;assert.deepEqual(audit.map(row=>row.metadata),[{channel:'phone',purpose:'pickup'},{channel:'phone',purpose:'delivery'}]);
   const serialized=JSON.stringify(audit);assert.equal(serialized.includes('+5531999990001'),false);assert.equal(serialized.includes('+5531999990002'),false);
  }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
 });
});
