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

test('seller settlement status is private and remains informational over HTTP/PostgreSQL',{
  skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const database=createDatabase({databaseUrl,databaseSsl:false});let api;
    try{
      await migrate(database,await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
        ($1,'settlement-seller@example.test','fixture','Vendedor fictício','customer'),
        ($2,'settlement-buyer@example.test','fixture','Comprador fictício','customer'),
        ($3,'settlement-courier@example.test','fixture','Entregador fictício','courier'),
        ($4,'settlement-outsider@example.test','fixture','Pessoa externa','customer'),
        ($5,'settlement-admin@example.test','fixture','Admin fictício','admin')`,[ids.seller,ids.buyer,ids.courier,ids.outsider,ids.admin]);
      await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,size,quantity,kind,price_cents,status)
        VALUES($1,$2,'Venda liquidável','Fixture de consulta de repasse sem pagamento.','infant','Marca fictícia','Modelo fictício','sealed','M',1,'sale',10000,'unavailable')`,[ids.listing,ids.seller]);
      await database.query("INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents) VALUES($1,$2,$3,$4,'in_delivery',10000)",[ids.transaction,ids.listing,ids.buyer,ids.seller]);
      await database.query(`INSERT INTO payment_intents(id,transaction_id,buyer_id,idempotency_key,method,amount_cents,platform_fee_cents,delivery_fee_cents,seller_amount_cents,provider_reference,status)
        VALUES($1,$2,$3,'seller-settlement-http-payment','pix',10000,800,0,9200,'payment-provider-fixture','paid')`,[ids.payment,ids.transaction,ids.buyer]);
      await database.query(`INSERT INTO shipments(id,transaction_id,buyer_id,seller_id,courier_id,mode,insured,idempotency_key,provider_reference,status)
        VALUES($1,$2,$3,$4,$5,'partner',false,'seller-settlement-http-shipment','logistics-provider-fixture','delivered')`,[ids.shipment,ids.transaction,ids.buyer,ids.seller,ids.courier]);
      await database.query(`INSERT INTO delivery_proofs(id,shipment_id,courier_id,media_key,recipient_name,latitude,longitude)
        VALUES($1,$2,$3,'proofs/settlement.webp','Pessoa fictícia',-19.9,-43.9)`,[ids.proof,ids.shipment,ids.courier]);
      await database.query('INSERT INTO delivery_receipt_approvals(proof_id,approver_id) VALUES($1,$2)',[ids.proof,ids.buyer]);
      await database.query("INSERT INTO delivery_proof_validations(proof_id,validator_id,reason) VALUES($1,$2,'Comprovante sintético validado para consulta.')",[ids.proof,ids.admin]);
      const service=createLogisticsService(createLogisticsRepository(database),null,null);
      const actors={seller:{id:ids.seller,role:'customer'},outsider:{id:ids.outsider,role:'customer'},admin:{id:ids.admin,role:'admin'}};
      api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),logisticsService:service,authService:{async session(token){return actors[token]??null;}}});
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      const endpoint=`http://127.0.0.1:${api.address().port}/v1/shipments/${ids.shipment}/settlement-status`,headers=token=>({cookie:`fc_session=${token}`});
      const forbidden=await fetch(endpoint,{headers:headers('outsider')});assert.equal(forbidden.status,404);
      const response=await fetch(endpoint,{headers:headers('seller')});const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));assert.equal(response.headers.get('cache-control'),'no-store');
      assert.equal(body.settlement.requirementsMet,true);assert.equal(body.settlement.payoutAllowed,false);assert.equal(body.settlement.payoutStatus,'not_configured');assert.equal(body.settlement.deadlineStatus,'provider_confirmation_pending');
      assert.equal(body.settlement.paymentIntentId,undefined);assert.equal(body.settlement.providerReference,undefined);assert.equal(body.settlement.sellerAmountCents,undefined);
      assert.equal((await database.query('SELECT count(*)::integer AS n FROM audit_events WHERE action=\'shipment.proof.read\' AND entity_id=$1',[ids.shipment])).rows[0].n,1);
      assert.equal((await database.query('SELECT count(*)::integer AS n FROM courier_payout_obligations WHERE shipment_id=$1',[ids.shipment])).rows[0].n,0);
    }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
  });
});
