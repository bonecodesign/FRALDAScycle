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
const ids={seller:'11111111-1111-4111-8111-111111111111',buyer:'22222222-2222-4222-8222-222222222222',courier:'33333333-3333-4333-8333-333333333333',outsider:'44444444-4444-4444-8444-444444444444',admin:'55555555-5555-4555-8555-555555555555',listing:'66666666-6666-4666-8666-666666666666',transaction:'77777777-7777-4777-8777-777777777777',payment:'88888888-8888-4888-8888-888888888888',shipment:'99999999-9999-4999-8999-999999999999',proof:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};

test('courier payout obligation is prepared once over HTTP/PostgreSQL without transferring funds',{
  skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const database=createDatabase({databaseUrl,databaseSsl:false});let api;
    try{
      await migrate(database,await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
        ($1,'payout-seller@example.test','fixture','Vendedor fictício','customer'),
        ($2,'payout-buyer@example.test','fixture','Comprador fictício','customer'),
        ($3,'payout-courier@example.test','fixture','Entregador fictício','courier'),
        ($4,'payout-outsider@example.test','fixture','Entregador externo','courier'),
        ($5,'payout-admin@example.test','fixture','Admin fictício','admin')`,[ids.seller,ids.buyer,ids.courier,ids.outsider,ids.admin]);
      await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,size,quantity,kind,price_cents,status)
        VALUES($1,$2,'Venda entregue','Fixture de obrigação financeira sem transferência.','infant','Marca fictícia','Modelo fictício','sealed','M',1,'sale',10000,'unavailable')`,[ids.listing,ids.seller]);
      await database.query("INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents) VALUES($1,$2,$3,$4,'in_delivery',10000)",[ids.transaction,ids.listing,ids.buyer,ids.seller]);
      await database.query(`INSERT INTO payment_intents(id,transaction_id,buyer_id,idempotency_key,method,amount_cents,platform_fee_cents,delivery_fee_cents,seller_amount_cents,provider_reference,status)
        VALUES($1,$2,$3,'courier-payout-http-payment','pix',12000,800,2000,9200,'payment-provider-fixture','paid')`,[ids.payment,ids.transaction,ids.buyer]);
      await database.query(`INSERT INTO shipments(id,transaction_id,buyer_id,seller_id,courier_id,mode,insured,idempotency_key,provider_reference,status)
        VALUES($1,$2,$3,$4,$5,'partner',false,'courier-payout-http-shipment','logistics-provider-fixture','delivered')`,[ids.shipment,ids.transaction,ids.buyer,ids.seller,ids.courier]);
      await database.query(`INSERT INTO delivery_proofs(id,shipment_id,courier_id,media_key,recipient_name,latitude,longitude)
        VALUES($1,$2,$3,'proofs/fixture.webp','Pessoa fictícia',-19.9,-43.9)`,[ids.proof,ids.shipment,ids.courier]);
      await database.query('INSERT INTO delivery_receipt_approvals(proof_id,approver_id) VALUES($1,$2)',[ids.proof,ids.buyer]);
      await database.query("INSERT INTO delivery_proof_validations(proof_id,validator_id,reason) VALUES($1,$2,'Comprovante sintético validado para teste.')",[ids.proof,ids.admin]);
      const service=createLogisticsService(createLogisticsRepository(database),null,null);
      const actors={courier:{id:ids.courier,role:'courier'},outsider:{id:ids.outsider,role:'courier'},admin:{id:ids.admin,role:'admin'}};
      api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),logisticsService:service,authService:{async session(token){return actors[token]??null;}}});
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      const endpoint=`http://127.0.0.1:${api.address().port}/v1/shipments/${ids.shipment}/courier-payout`,headers=token=>({'content-type':'application/json',cookie:`fc_session=${token}`});
      const hidden=await fetch(endpoint,{headers:headers('outsider')});assert.equal(hidden.status,404);
      const visible=await fetch(endpoint,{headers:headers('courier')});const status=await visible.json();assert.equal(visible.status,200);assert.equal(status.payout.eligible,true);assert.equal(status.payout.payoutAllowed,false);assert.equal(status.payout.status,'not_prepared');assert.equal(status.payout.freightCents,2000);
      const forbidden=await fetch(endpoint,{method:'POST',headers:headers('courier'),body:JSON.stringify({confirmed:true})});assert.equal(forbidden.status,403);
      const prepared=await fetch(endpoint,{method:'POST',headers:headers('admin'),body:JSON.stringify({confirmed:true})});const first=await prepared.json();assert.equal(prepared.status,201,JSON.stringify(first));assert.equal(first.payout.status,'provider_pending');assert.equal(first.payout.courier_amount_cents,1900);
      const replay=await fetch(endpoint,{method:'POST',headers:headers('admin'),body:JSON.stringify({confirmed:true})});assert.equal(replay.status,200);assert.equal((await replay.json()).payout.reused,true);
      const stored=(await database.query('SELECT freight_cents,platform_fee_cents,courier_amount_cents,status,provider_reference FROM courier_payout_obligations WHERE shipment_id=$1',[ids.shipment])).rows[0];
      assert.deepEqual(stored,{freight_cents:2000,platform_fee_cents:100,courier_amount_cents:1900,status:'provider_pending',provider_reference:null});
      assert.equal((await database.query('SELECT count(*)::integer AS n FROM courier_payout_obligations WHERE shipment_id=$1',[ids.shipment])).rows[0].n,1);
      assert.equal((await database.query("SELECT count(*)::integer AS n FROM audit_events WHERE action='courier.payout.prepared' AND entity_id=$1",[ids.shipment])).rows[0].n,1);
    }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
  });
});
