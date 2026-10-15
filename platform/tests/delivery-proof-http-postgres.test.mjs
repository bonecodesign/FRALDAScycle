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
const ids={seller:'11111111-1111-4111-8111-111111111111',buyer:'22222222-2222-4222-8222-222222222222',courier:'33333333-3333-4333-8333-333333333333',outsider:'44444444-4444-4444-8444-444444444444',admin:'55555555-5555-4555-8555-555555555555',listing:'66666666-6666-4666-8666-666666666666',transaction:'77777777-7777-4777-8777-777777777777',shipment:'88888888-8888-4888-8888-888888888888'};

test('minimum delivery proof is assigned, private and audited over HTTP/PostgreSQL',{
  skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const database=createDatabase({databaseUrl,databaseSsl:false});let api;
    try{
      await migrate(database,await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
        ($1,'proof-seller@example.test','fixture','Vendedor fictício','customer'),
        ($2,'proof-buyer@example.test','fixture','Comprador fictício','customer'),
        ($3,'proof-courier@example.test','fixture','Entregador fictício','courier'),
        ($4,'proof-outsider@example.test','fixture','Pessoa externa','customer'),
        ($5,'proof-admin@example.test','fixture','Admin fictício','admin')`,[ids.seller,ids.buyer,ids.courier,ids.outsider,ids.admin]);
      await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,quantity,kind,price_cents,status)
        VALUES($1,$2,'Venda fictícia entregue','Pacote fictício para comprovante mínimo.','infant','Pampers','Confort Sec','sealed',1,'sale',10000,'unavailable')`,[ids.listing,ids.seller]);
      await database.query("INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents) VALUES($1,$2,$3,$4,'paid',10000)",[ids.transaction,ids.listing,ids.buyer,ids.seller]);
      await database.query("INSERT INTO shipments(id,transaction_id,buyer_id,seller_id,courier_id,mode,insured,idempotency_key,status) VALUES($1,$2,$3,$4,$5,'partner',false,'delivery-proof-http-fixture','in_transit')",[ids.shipment,ids.transaction,ids.buyer,ids.seller,ids.courier]);
      const reads=[];
      const logisticsService=createLogisticsService(createLogisticsRepository(database),null,{async signedProofRead(actorId,mediaKey){reads.push({actorId,mediaKey});return {url:'https://private.invalid/signed-proof',expiresInSeconds:60};}});
      const actors={seller:{id:ids.seller,role:'customer'},buyer:{id:ids.buyer,role:'customer'},courier:{id:ids.courier,role:'courier'},outsider:{id:ids.outsider,role:'customer'},admin:{id:ids.admin,role:'admin'}};
      api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),logisticsService,authService:{async session(token){return actors[token]??null;}}});
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({cookie:`fc_session=${token}`,'content-type':'application/json'}),proofUrl=`${origin}/v1/shipments/${ids.shipment}/proof`;
      const outsiderWrite=await fetch(proofUrl,{method:'POST',headers:headers('outsider'),body:'{}'});assert.equal(outsiderWrite.status,403);
      const input={mediaKey:'private/proofs/delivery-one',recipientName:'Recebedor fictício',latitude:-19.9167,longitude:-43.9345};
      const created=await fetch(proofUrl,{method:'POST',headers:headers('courier'),body:JSON.stringify(input)}),createdBody=await created.json();assert.equal(created.status,201,JSON.stringify(createdBody));assert.equal(createdBody.proof.duplicate,false);
      const repeated=await fetch(proofUrl,{method:'POST',headers:headers('courier'),body:JSON.stringify(input)});assert.equal(repeated.status,201);assert.equal((await repeated.json()).proof.duplicate,true);
      for(const token of ['buyer','seller','courier','admin']){const response=await fetch(proofUrl,{headers:headers(token)}),body=await response.json();assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.proof.mediaKey,input.mediaKey);assert.equal(response.headers.get('cache-control'),'no-store');}
      const outsiderRead=await fetch(proofUrl,{headers:headers('outsider')});assert.equal(outsiderRead.status,404);
      const photo=await fetch(`${proofUrl}/photo`,{headers:headers('buyer')}),photoBody=await photo.json();assert.equal(photo.status,200,JSON.stringify(photoBody));assert.equal(photo.headers.get('cache-control'),'no-store');assert.equal(photoBody.image.url,'https://private.invalid/signed-proof');assert.deepEqual(reads,[{actorId:ids.buyer,mediaKey:input.mediaKey}]);
      const outsiderPhoto=await fetch(`${proofUrl}/photo`,{headers:headers('outsider')});assert.equal(outsiderPhoto.status,404);assert.equal(reads.length,1);
      const row=(await database.query(`SELECT p.media_key,p.recipient_name,p.latitude,p.longitude,s.status,t.status AS transaction_status FROM delivery_proofs p JOIN shipments s ON s.id=p.shipment_id JOIN transactions t ON t.id=s.transaction_id WHERE s.id=$1`,[ids.shipment])).rows[0];assert.equal(row.media_key,input.mediaKey);assert.equal(row.recipient_name,input.recipientName);assert.equal(row.status,'delivered');assert.equal(row.transaction_status,'in_delivery');
      const audit=JSON.stringify((await database.query("SELECT action,metadata FROM audit_events WHERE entity_id=$1 AND action IN ('shipment.proof.created','shipment.proof.read') ORDER BY id",[ids.shipment])).rows);assert.equal(audit.includes(input.mediaKey),false);assert.equal(audit.includes(input.recipientName),false);
    }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
  });
});
