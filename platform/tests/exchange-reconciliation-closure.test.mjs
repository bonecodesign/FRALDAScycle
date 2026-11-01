import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const migrationUrl=new URL('../database/migrations/120_exchange_reconciliation_closure.sql',import.meta.url);

test('reconciliation alerts close only from immutable provider confirmation evidence',async()=>{
 const sql=await readFile(migrationUrl,'utf8');
 assert.match(sql,/PRIMARY KEY REFERENCES exchange_difference_settlement_commands/);
 assert.match(sql,/confirmation_source IN \('webhook','poll'\)/);
 assert.match(sql,/evidence_sha256 ~ '\^\[0-9a-f\]\{64\}\$'/);
 assert.match(sql,/NEW\.action <> 'exchange\.difference\.settlement_confirmed'/);
 assert.match(sql,/resolved_at=now\(\),resolution_command_id=NEW\.entity_id::uuid/);
 assert.match(sql,/staff_access_level IN \(3,4,5\)/);
 assert.match(sql,/ON CONFLICT\(command_id\) DO NOTHING/);
});

test('closure notification is idempotent and does not expose provider payload',async()=>{
 const sql=await readFile(migrationUrl,'utf8');
 assert.match(sql,/provider-confirmed/);
 assert.match(sql,/GET DIAGNOSTICS inserted_rows = ROW_COUNT/);
 assert.match(sql,/IF inserted_rows = 0 THEN/);
 assert.doesNotMatch(sql,/payload_raw|document|birth_date|cpf/i);
});

