import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiServer} from '../apps/api/server.js';
import {loadConfig} from '../apps/api/config.js';
import {createDeliveryQuoteService} from '../apps/api/delivery-quote-service.js';
import {createDatabase} from '../database/client.js';
import {createDeliveryQuoteRepository} from '../database/delivery-quote-repository.js';
import {discoverMigrations,migrate} from '../database/migrate.js';

const databaseUrl=process.env.FC_LISTING_TEST_DATABASE_URL;
test('buyer confirms exact external quote while tampering and paid replacement fail over HTTP/PostgreSQL',{skip:!databaseUrl?'Banco temporário não configurado.':false,timeout:60000},async()=>{
 const database=createDatabase({databaseUrl,databaseSsl:false});let server;
 const ids={seller:'11111111-1111-4111-8111-111111111111',buyer:'22222222-2222-4222-8222-222222222222',outsider:'33333333-3333-4333-8333-333333333333',listing:'44444444-4444-4444-8444-444444444444',transaction:'55555555-5555-4555-8555-555555555555'};
 const request={originAddressId:'origin-address',originAddressVersion:1,destinationAddressId:'destination-address',destinationAddressVersion:1,mode:'partner',listingId:ids.listing,quantity:1,packageVersion:1};
 try{
  await migrate(database,await discoverMigrations());
  await database.query(`INSERT INTO users(id,email,password_hash,display_name) VALUES($1,'quote-seller@example.test','fixture','Vendedor'),($2,'quote-buyer@example.test','fixture','Comprador'),($3,'quote-outsider@example.test','fixture','Externo')`,[ids.seller,ids.buyer,ids.outsider]);
  await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,quantity,kind,price_cents,status) VALUES($1,$2,'Venda com frete','Fixture sintética de cotação externa.','infant','Marca','Modelo','sealed',1,'sale',10000,'unavailable')`,[ids.listing,ids.seller]);
  await database.query("INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents) VALUES($1,$2,$3,$4,'payment_pending',10000)",[ids.transaction,ids.listing,ids.buyer,ids.seller]);
  const repository=createDeliveryQuoteRepository(database),service=createDeliveryQuoteService(repository);
  const quote=await service.registerCalculated(ids.transaction,{provider:'lalamove',quoteId:'lalamove-external-quote-1',baseFreightCents:2000,customerTotalCents:2100,currency:'BRL',expiresAt:new Date(Date.now()+60000).toISOString()},request);
  server=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),deliveryQuoteService:service,authService:{async session(token){return Object.entries({buyer:ids.buyer,outsider:ids.outsider}).find(([key])=>key===token)?.[1]?{id:token==='buyer'?ids.buyer:ids.outsider,role:'customer'}:null;}}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const endpoint=`http://127.0.0.1:${server.address().port}/v1/delivery-quotes/${quote.id}/confirm`,headers=token=>({'content-type':'application/json',cookie:`fc_session=${token}`});
  const body={providerQuoteId:'lalamove-external-quote-1',customerTotalCents:2100,request};
  assert.equal((await fetch(endpoint,{method:'POST',headers:headers('outsider'),body:JSON.stringify(body)})).status,404);
  assert.equal((await fetch(endpoint,{method:'POST',headers:headers('buyer'),body:JSON.stringify({...body,customerTotalCents:2099})})).status,409);
  const confirmed=await fetch(endpoint,{method:'POST',headers:headers('buyer'),body:JSON.stringify(body)});assert.equal(confirmed.status,201,JSON.stringify(await confirmed.clone().json()));
  const stored=(await database.query('SELECT provider,base_freight_cents,platform_fee_cents,customer_total_cents,status FROM delivery_quotes WHERE id=$1',[quote.id])).rows[0];assert.deepEqual(stored,{provider:'lalamove',base_freight_cents:2000,platform_fee_cents:100,customer_total_cents:2100,status:'confirmed'});
  await repository.lockForPayment({transactionId:ids.transaction,paymentIntentId:'synthetic-payment-reference'});
  await assert.rejects(service.registerCalculated(ids.transaction,{provider:'loggi_express',quoteId:'loggi-replacement-quote-1',baseFreightCents:1900,customerTotalCents:1995,currency:'BRL',expiresAt:new Date(Date.now()+60000).toISOString()},request),error=>error.code==='paid_transaction_locked');
 }finally{if(server?.listening)await new Promise(resolve=>server.close(resolve));await database.close();}
});

test('each exchange receiver confirms only the quote for their own delivery leg',{skip:!databaseUrl?'Banco temporário não configurado.':false,timeout:60000},async()=>{
 const database=createDatabase({databaseUrl,databaseSsl:false});let server;
 const ids={requester:'61111111-1111-4111-8111-111111111111',owner:'62222222-2222-4222-8222-222222222222',listing:'63333333-3333-4333-8333-333333333333',transaction:'64444444-4444-4444-8444-444444444444',leg1:'65555555-5555-4555-8555-555555555551',leg2:'65555555-5555-4555-8555-555555555552'};
 const quoteRequest=leg=>({originAddressId:`exchange-origin-${leg}`,originAddressVersion:1,destinationAddressId:`exchange-destination-${leg}`,destinationAddressVersion:1,mode:'partner',listingId:ids.listing,quantity:1,packageVersion:1});
 try{
  await migrate(database,await discoverMigrations());
  await database.query(`INSERT INTO users(id,email,password_hash,display_name) VALUES($1,'exchange-requester-quote@example.test','fixture','Solicitante'),($2,'exchange-owner-quote@example.test','fixture','Proprietário')`,[ids.requester,ids.owner]);
  await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,quantity,kind,status) VALUES($1,$2,'Troca com duas pernas','Fixture sintética de frete bilateral.','infant','Marca','Modelo','sealed',1,'exchange','unavailable')`,[ids.listing,ids.owner]);
  await database.query("INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status) VALUES($1,$2,$3,$4,'in_delivery')",[ids.transaction,ids.listing,ids.requester,ids.owner]);
  await database.query(`INSERT INTO shipments(id,transaction_id,buyer_id,seller_id,mode,insured,idempotency_key,status,exchange_leg,logistics_payer_id) VALUES($1,$3,$4,$5,'partner',false,'exchange-quote-leg-1','awaiting_pickup',1,$4),($2,$3,$5,$4,'partner',false,'exchange-quote-leg-2','awaiting_pickup',2,$5)`,[ids.leg1,ids.leg2,ids.transaction,ids.owner,ids.requester]);
  const service=createDeliveryQuoteService(createDeliveryQuoteRepository(database));
  const leg1=await service.registerCalculatedForShipment(ids.transaction,ids.leg1,{provider:'lalamove',quoteId:'exchange-leg-one-quote',baseFreightCents:2000,customerTotalCents:2100,currency:'BRL',expiresAt:new Date(Date.now()+60000).toISOString()},quoteRequest(1));
  const leg2=await service.registerCalculatedForShipment(ids.transaction,ids.leg2,{provider:'loggi_express',quoteId:'exchange-leg-two-quote',baseFreightCents:3000,customerTotalCents:3150,currency:'BRL',expiresAt:new Date(Date.now()+60000).toISOString()},quoteRequest(2));
  const accounts={requester:ids.requester,owner:ids.owner};
  server=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),deliveryQuoteService:service,authService:{async session(token){return accounts[token]?{id:accounts[token],role:'customer'}:null;}}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`,headers=token=>({'content-type':'application/json',cookie:`fc_session=${token}`});
  const confirm=({quote,providerQuoteId,total,request,token})=>fetch(`${origin}/v1/delivery-quotes/${quote.id}/confirm`,{method:'POST',headers:headers(token),body:JSON.stringify({providerQuoteId,customerTotalCents:total,request})});
  assert.equal((await confirm({quote:leg1,providerQuoteId:'exchange-leg-one-quote',total:2100,request:quoteRequest(1),token:'requester'})).status,404);
  assert.equal((await confirm({quote:leg1,providerQuoteId:'exchange-leg-one-quote',total:2100,request:quoteRequest(1),token:'owner'})).status,201);
  assert.equal((await confirm({quote:leg2,providerQuoteId:'exchange-leg-two-quote',total:3150,request:quoteRequest(2),token:'requester'})).status,201);
  const stored=(await database.query('SELECT shipment_id,confirmed_by,customer_total_cents,status FROM delivery_quotes WHERE transaction_id=$1 ORDER BY shipment_id',[ids.transaction])).rows;
  assert.deepEqual(stored,[{shipment_id:ids.leg1,confirmed_by:ids.owner,customer_total_cents:2100,status:'confirmed'},{shipment_id:ids.leg2,confirmed_by:ids.requester,customer_total_cents:3150,status:'confirmed'}]);
 }finally{if(server?.listening)await new Promise(resolve=>server.close(resolve));await database.close();}
});
