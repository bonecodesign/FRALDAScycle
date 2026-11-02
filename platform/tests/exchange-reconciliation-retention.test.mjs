import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createExchangeReconciliationRetentionRepository} from '../database/exchange-reconciliation-retention-repository.js';
import {anonymizeExpiredExchangeReconciliations,millisecondsUntilDailyRetention,runExchangeReconciliationRetention} from '../workers/exchange-reconciliation-retention.js';

test('five-year retention removes links and evidence while preserving anonymous statistics',async()=>{
 const calls=[];const client={async query(sql,values){calls.push({sql,values});if(/SELECT id FROM/.test(sql))return{rows:[{id:'11111111-1111-4111-8111-111111111111'}]};if(/UPDATE exchange_settlement_reconciliation_closures/.test(sql))return{rows:[{id:'11111111-1111-4111-8111-111111111111'}]};return{rows:[]};}};
 const database={async transaction(work){return work(client);}};
 assert.deepEqual(await anonymizeExpiredExchangeReconciliations(createExchangeReconciliationRetentionRepository(database)),{anonymized:1});
 const update=calls.find(({sql})=>/UPDATE exchange_settlement_reconciliation_closures/.test(sql));
 assert.match(update.sql,/command_id=NULL,recovery_command_id=NULL,evidence_sha256=NULL,confirmed_at=NULL/);
 assert.ok(calls.some(({sql})=>/DELETE FROM exchange_settlement_reconciliation_alerts/.test(sql)));
 assert.deepEqual(JSON.parse(calls.at(-1).values[0]),{retentionYears:5,anonymized:1,personalIdentifiersRetained:false});
});

test('retention worker is disabled without explicit legal acknowledgement',async()=>{
 await assert.rejects(runExchangeReconciliationRetention({mode:'serve',env:{NODE_ENV:'production',DATABASE_URL:'postgresql://db.example.test/fc',EXCHANGE_RECONCILIATION_RETENTION_ENABLED:'true'}}),/aprovação jurídica/);
});

test('daily schedule targets 06:30 UTC and rolls to the next day',()=>{
 assert.equal(millisecondsUntilDailyRetention(new Date('2030-01-02T06:00:00Z')),30*60*1000);
 assert.equal(millisecondsUntilDailyRetention(new Date('2030-01-02T06:30:00Z')),24*60*60*1000);
 assert.equal(millisecondsUntilDailyRetention(new Date('2030-01-02T07:00:00Z')),23.5*60*60*1000);
});

test('retention failures escalate strictly through levels 3, 4 and 5',async()=>{
 let incident=null;const notified=[];const client={async query(sql,values){
  if(/SELECT \* FROM exchange_reconciliation_retention_incidents/.test(sql))return{rows:incident?[incident]:[]};
  if(/INSERT INTO exchange_reconciliation_retention_incidents/.test(sql)){incident={id:'incident',consecutive_failures:1,highest_notified_level:3};return{rows:[incident]};}
  if(/UPDATE exchange_reconciliation_retention_incidents SET consecutive/.test(sql)){incident={...incident,consecutive_failures:values[1],highest_notified_level:values[2]};return{rows:[incident]};}
  if(/SELECT u\.id,u\.email/.test(sql)){notified.push(values[0]);return{rows:[]};}
  return{rows:[]};
 }};const repository=createExchangeReconciliationRetentionRepository({async transaction(work){return work(client);}});
 assert.equal((await repository.recordFailure({failureCode:'provider_timeout'})).notifiedAccessLevel,3);
 assert.equal((await repository.recordFailure({failureCode:'provider_timeout'})).notifiedAccessLevel,4);
 assert.equal((await repository.recordFailure({failureCode:'provider_timeout'})).notifiedAccessLevel,5);
 assert.equal((await repository.recordFailure({failureCode:'provider_timeout'})).notifiedAccessLevel,null);
 assert.deepEqual(notified,[3,4,5]);
});

test('successful daily run resolves the open failure sequence',async()=>{
 const calls=[],levels=[];const client={async query(sql,values){calls.push(sql);if(/UPDATE exchange_reconciliation_retention_incidents/.test(sql))return{rows:[{id:'incident',consecutive_failures:2,highest_notified_level:4}]};if(/SELECT u\.id,u\.email/.test(sql)){levels.push(values[0]);return{rows:[{id:`staff-${values[0]}`,email:null,email_verified_at:null,email_enabled:false}]};}return{rows:[]};}};
 const result=await createExchangeReconciliationRetentionRepository({async transaction(work){return work(client);}}).recordSuccess();
 assert.equal(result.resolved,true);assert.deepEqual(result.notifiedLevels,[3,4]);assert.equal(result.staffNotified,2);assert.deepEqual(levels,[3,4]);assert.ok(calls.some(sql=>/retention_recovered/.test(sql)));
});

test('recovery notifies level 5 only when founder escalation happened',async()=>{
 const levels=[];const client={async query(sql,values){if(/UPDATE exchange_reconciliation_retention_incidents/.test(sql))return{rows:[{id:'incident',consecutive_failures:3,highest_notified_level:5}]};if(/SELECT u\.id,u\.email/.test(sql)){levels.push(values[0]);return{rows:[]};}return{rows:[]};}};
 const result=await createExchangeReconciliationRetentionRepository({async transaction(work){return work(client);}}).recordSuccess();
 assert.deepEqual(result.notifiedLevels,[3,4,5]);assert.deepEqual(levels,[3,4,5]);
});

test('retention migration fixes five years and enforces anonymous state',async()=>{
 const sql=await readFile(new URL('../database/migrations/121_exchange_reconciliation_retention.sql',import.meta.url),'utf8');
 assert.match(sql,/confirmed_at\+interval '5 years'/);
 assert.match(sql,/anonymized_at IS NOT NULL AND command_id IS NULL/);
 assert.match(sql,/evidence_sha256 IS NULL AND confirmed_at IS NULL/);
});

