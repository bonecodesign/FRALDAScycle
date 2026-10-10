import test from 'node:test';
import assert from 'node:assert/strict';
import {nativePostgresTools,withNativeTestPostgres} from '../tools/native-postgres.mjs';
import {createDatabase} from '../database/client.js';
import {createLogisticsRepository} from '../database/logistics-repository.js';
import {createLogisticsService} from '../apps/api/logistics-service.js';
const native=await nativePostgresTools();
test('courier pagination reads 60 active and 60 historic records with isolation in PostgreSQL',{skip:!native&&!process.env.CI,timeout:60000},async()=>{
 await withNativeTestPostgres(async databaseUrl=>{
  const database=createDatabase({databaseUrl,databaseSsl:false});
  try {
   // Isolated query fixture; the integrated beta separately validates the migrated application schema.
   await database.query(`CREATE TABLE shipments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),courier_id uuid,status text,mode text,insured boolean,estimated_delivery_at timestamptz,created_at timestamptz,updated_at timestamptz)`);
   const own='11111111-1111-4111-8111-111111111111',foreign='22222222-2222-4222-8222-222222222222';
   await database.query(`INSERT INTO shipments(courier_id,status,mode,insured,created_at,updated_at)
     SELECT $1,CASE WHEN n<=60 THEN 'assigned' ELSE 'delivered' END,'postal',false,
       '2026-10-09T12:00:00Z'::timestamptz+n*interval '1 second','2026-10-09T12:00:00Z'::timestamptz+n*interval '1 second'
     FROM generate_series(1,120) n`,[own]);
   await database.query(`INSERT INTO shipments(courier_id,status,mode,insured,created_at,updated_at) SELECT $1,'assigned','postal',false,now(),now() FROM generate_series(1,10)`,[foreign]);
   const service=createLogisticsService(createLogisticsRepository(database),null,null);
   for(const history of [false,true]){
    const first=await service.courierPage({id:own,role:'courier'},{history,page:'1'});
    const second=await service.courierPage({id:own,role:'courier'},{history,page:'2'});
    assert.equal(first.items.length,50);assert.equal(first.hasMore,true);assert.equal(second.items.length,10);assert.equal(second.hasMore,false);
    assert.equal(new Set([...first.items,...second.items].map(row=>row.id)).size,60);
    assert.equal((await service.courierPage({id:own,role:'courier'},{history,page:'3'})).items.length,0);
   }
   assert.equal((await service.courierPage({id:foreign,role:'courier'})).items.length,10);
  } finally {await database.close();}
 });
});
