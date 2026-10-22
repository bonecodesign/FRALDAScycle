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
const ids={seller:'11111111-1111-4111-8111-111111111111',buyer:'22222222-2222-4222-8222-222222222222',listing:'33333333-3333-4333-8333-333333333333',transaction:'44444444-4444-4444-8444-444444444444'};

test('local pickup stays unavailable over HTTP/PostgreSQL without creating freight records',{
  skip:!native&&!process.env.CI?'PostgreSQL nativo ausente neste ambiente.':false,timeout:60000,
},async()=>{
  await withNativeTestPostgres(async databaseUrl=>{
    const database=createDatabase({databaseUrl,databaseSsl:false});let api;
    try{
      await migrate(database,await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name) VALUES
        ($1,'freight-seller@example.test','fixture','Vendedor fictício'),
        ($2,'freight-buyer@example.test','fixture','Comprador fictício')`,[ids.seller,ids.buyer]);
      await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,open_package_attested,size,quantity,kind,price_cents,status)
        VALUES($1,$2,'Venda fictícia','Pacote fictício para responsabilidade do frete.','infant','Marca fictícia','Modelo fictício','sealed',false,'M',1,'sale',10000,'unavailable')`,[ids.listing,ids.seller]);
      await database.query("INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents) VALUES($1,$2,$3,$4,'paid',10000)",[ids.transaction,ids.listing,ids.buyer,ids.seller]);
      const service=createLogisticsService(createLogisticsRepository(database),null,null);
      const actors={buyer:{id:ids.buyer,role:'customer'},seller:{id:ids.seller,role:'customer'}};
      api=createApiServer({config:loadConfig({NODE_ENV:'test',RATE_LIMIT_MAX:'1000'}),logisticsService:service,authService:{async session(token){return actors[token]??null;}}});
      await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
      const origin=`http://127.0.0.1:${api.address().port}`,headers=token=>({'content-type':'application/json',cookie:`fc_session=${token}`});
      const payload={transactionId:ids.transaction,mode:'pickup',insured:false,idempotencyKey:'sale-freight-responsibility-http'};
      for(const actor of ['seller','buyer']){
        const response=await fetch(`${origin}/v1/shipments`,{method:'POST',headers:headers(actor),body:JSON.stringify(payload)});
        const body=await response.json();
        assert.equal(response.status,422,JSON.stringify(body));
        assert.equal(body.error.code,'invalid_shipment_mode');
      }
      assert.equal((await database.query('SELECT count(*)::integer AS n FROM shipments WHERE transaction_id=$1',[ids.transaction])).rows[0].n,0);
      assert.equal((await database.query('SELECT count(*)::integer AS n FROM payment_intents WHERE transaction_id=$1',[ids.transaction])).rows[0].n,0);
    }finally{if(api?.listening)await new Promise(resolve=>api.close(resolve));await database.close();}
  });
});
