import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createLogisticsService} from '../apps/api/logistics-service.js';
import {createMarketplaceService} from '../apps/api/marketplace-service.js';
import {createAddressRepository} from '../database/address-repository.js';
import {createDatabase} from '../database/client.js';
import {createMarketplaceRepository} from '../database/marketplace-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';

const native=await nativePostgresTools();
const ids={seller:'11111111-1111-4111-8111-111111111111',buyer:'22222222-2222-4222-8222-222222222222',courier:'33333333-3333-4333-8333-333333333333',other:'44444444-4444-4444-8444-444444444444',admin:'55555555-5555-4555-8555-555555555555',listing:'66666666-6666-4666-8666-666666666666',transaction:'77777777-7777-4777-8777-777777777777',intent:'88888888-8888-4888-8888-888888888888',shipment:'99999999-9999-4999-8999-999999999999',address:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',publicListing:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};

test('exact address is private, stage-bound and makes cancellation support-only over HTTP/PostgreSQL',{
  skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const database=createDatabase({databaseUrl,databaseSsl:false});let api;
    try{
      await migrate(database,await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
        ($1,'address-seller@example.test','fixture','Vendedor fictício','customer'),
        ($2,'address-buyer@example.test','fixture','Comprador fictício','customer'),
        ($3,'address-courier@example.test','fixture','Entregador fictício','courier'),
        ($4,'address-other@example.test','fixture','Pessoa externa','customer'),
        ($5,'address-admin@example.test','fixture','Admin fictício','admin')`,[ids.seller,ids.buyer,ids.courier,ids.other,ids.admin]);
      await database.query(`INSERT INTO addresses(id,user_id,label,postal_code,street,number,complement,district,city,state)
        VALUES($1,$2,'Casa fictícia','30110000','Rua Privada Fictícia','123','Apto 1','Centro','Belo Horizonte','MG')`,[ids.address,ids.buyer]);
      await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,quantity,kind,price_cents,status,city,state,latitude,longitude)
        VALUES($1,$2,'Venda fictícia com endereço','Pacote fictício para entrega protegida.','infant','Pampers','Confort Sec','sealed',1,'sale',10000,'unavailable','Belo Horizonte','MG',-19.920000,-43.940000)`,[ids.listing,ids.seller]);
      await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,quantity,kind,price_cents,status,city,state,latitude,longitude,published_at,expires_at)
        VALUES($1,$2,'Anúncio público fictício','Localização pública aproximada.','infant','Pampers','Confort Sec','sealed',1,'sale',9000,'published','Belo Horizonte','MG',-19.920000,-43.940000,now(),now()+interval '30 days')`,[ids.publicListing,ids.seller]);
      await database.query("INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents) VALUES($1,$2,$3,$4,'paid',10000)",[ids.transaction,ids.listing,ids.buyer,ids.seller]);
      await database.query(`INSERT INTO payment_intents(id,transaction_id,buyer_id,idempotency_key,method,amount_cents,platform_fee_cents,delivery_fee_cents,seller_amount_cents,provider_reference,status)
        VALUES($1,$2,$3,'private-address-payment','pix',10000,800,0,9200,'private-address-provider','provider_pending')`,[ids.intent,ids.transaction,ids.buyer]);
      await database.query("INSERT INTO shipments(id,transaction_id,buyer_id,seller_id,courier_id,mode,insured,idempotency_key,status) VALUES($1,$2,$3,$4,$5,'partner',false,'private-address-shipment','assigned')",[ids.shipment,ids.transaction,ids.buyer,ids.seller,ids.courier]);
      const logisticsService=createLogisticsService(createAddressRepository(database),{});
      const marketplaceService=createMarketplaceService(createMarketplaceRepository(database));
      const actors={seller:{id:ids.seller,role:'customer'},buyer:{id:ids.buyer,role:'customer'},courier:{id:ids.courier,role:'courier'},other:{id:ids.other,role:'customer'},admin:{id:ids.admin,role:'admin'}};
      api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),logisticsService,marketplaceService,authService:{async session(token){return actors[token]??null;}}});
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({cookie:`fc_session=${token}`,'content-type':'application/json'}),addressUrl=`${origin}/v1/shipments/${ids.shipment}/addresses`,shareBody=JSON.stringify({addressId:ids.address,confirmed:true,noticeVersion:'FC-ADDRESS-1'});

      const publicListing=await fetch(`${origin}/v1/listings/${ids.publicListing}`),publicText=await publicListing.text();assert.equal(publicListing.status,200,publicText);for(const secret of ['Rua Privada Fictícia','30110000','Apto 1'])assert.equal(publicText.includes(secret),false);
      const early=await fetch(addressUrl,{method:'POST',headers:headers('buyer'),body:shareBody});assert.equal(early.status,409);assert.equal((await early.json()).error.code,'address_share_not_allowed');
      await database.query("UPDATE payment_intents SET status='paid' WHERE id=$1",[ids.intent]);
      const missingConsent=await fetch(addressUrl,{method:'POST',headers:headers('buyer'),body:JSON.stringify({addressId:ids.address,confirmed:false,noticeVersion:'FC-ADDRESS-1'})});assert.equal(missingConsent.status,422);assert.equal((await missingConsent.json()).error.code,'address_consent_required');
      const shared=await fetch(addressUrl,{method:'POST',headers:headers('buyer'),body:shareBody}),sharedBody=await shared.json();assert.equal(shared.status,201,JSON.stringify(sharedBody));assert.equal(shared.headers.get('cache-control'),'no-store');assert.equal(sharedBody.share.reused,false);
      for(const denied of ['seller','other','admin']){const response=await fetch(addressUrl,{headers:headers(denied)});assert.equal(response.status,404,denied);assert.equal((await response.json()).error.code,'shared_address_not_found');}
      for(const allowed of ['buyer','courier']){const response=await fetch(addressUrl,{headers:headers(allowed)}),body=await response.json();assert.equal(response.status,200,JSON.stringify(body));assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(body.items[0].address_snapshot.street,'Rua Privada Fictícia');}
      const direct=await fetch(`${origin}/v1/transactions/${ids.transaction}/cancel`,{method:'POST',headers:headers('buyer'),body:'{}'});assert.equal(direct.status,409);assert.equal((await direct.json()).error.code,'cancellation_requires_support');
      await database.query("UPDATE shipments SET status='delivered' WHERE id=$1",[ids.shipment]);
      const expired=await fetch(addressUrl,{headers:headers('courier')});assert.equal(expired.status,404);assert.equal((await expired.json()).error.code,'shared_address_not_found');
      const marker=(await database.query('SELECT address_shared_at FROM transactions WHERE id=$1',[ids.transaction])).rows[0];assert.ok(marker.address_shared_at);
      const audits=(await database.query("SELECT action,metadata FROM audit_events WHERE action IN('shipment.address.shared','shipment.address.read') AND entity_id=$1 ORDER BY id",[ids.shipment])).rows;assert.equal(audits.length,3);const serialized=JSON.stringify(audits);for(const secret of ['Rua Privada Fictícia','30110000','123','Apto 1'])assert.equal(serialized.includes(secret),false);
    }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
  });
});
