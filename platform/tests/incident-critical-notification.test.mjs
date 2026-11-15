import assert from 'node:assert/strict';import test from 'node:test';import {createOperationalIncidentRepository} from '../database/operational-incident-repository.js';
const id='11111111-1111-4111-8111-111111111111';
function database(){const calls=[],client={async query(sql,values){calls.push({sql,values});if(sql.includes('SELECT id FROM operational_incidents'))return{rows:[]};if(sql.includes('INSERT INTO operational_incidents'))return{rows:[{id,reference:values[0]}]};return{rows:[]};}};return{calls,transaction:operation=>operation(client)};}
test('critical incident queues a minimal email only for founder and accepted response roles',async()=>{const db=database();await createOperationalIncidentRepository(db).create({actorUserId:id,reference:'FC-INC-TEST',idempotencyKey:id,title:'Incidente crítico sintético',summary:'Resumo sem dados pessoais para validação.',severity:'critical',domain:'payments'});const queued=db.calls.find(call=>call.sql.includes('incident_critical_notice'));assert.ok(queued);assert.match(queued.sql,/staff_access_level=5/);assert.match(queued.sql,/r\.status='accepted'/);assert.doesNotMatch(queued.values[0],/Resumo sem dados pessoais/);assert.match(queued.values[0],/FC-INC-TEST/);});
test('noncritical incident does not enqueue the critical channel',async()=>{const db=database();await createOperationalIncidentRepository(db).create({actorUserId:id,reference:'FC-INC-LOW',idempotencyKey:id,title:'Incidente operacional sintético',summary:'Resumo sem dados pessoais para validação.',severity:'low',domain:'marketplace'});assert.equal(db.calls.some(call=>call.sql.includes('incident_critical_notice')),false);});

test('incident audit transition fields cannot be overridden by supplied metadata', async () => {
  const calls = [];
  const current = { id, status: 'open', assigned_to: null, resolved_at: null, version: 2 };
  const client = { async query(sql, values) {
    calls.push({ sql, values });
    if (sql.includes('SELECT * FROM operational_incidents')) return { rows: [current] };
    if (sql.includes('UPDATE operational_incidents SET')) return { rows: [{ ...current, status: 'contained', version: 3 }] };
    return { rows: [] };
  }};
  const repo = createOperationalIncidentRepository({ transaction: fn => fn(client) });
  await repo.change({ actorUserId: id, id, expectedVersion: 2, action: 'contain',
    note: 'Synthetic containment', metadata: { status: 'resolved', previousStatus: 'resolved', version: 999, previousVersion: 999, assessment: 'synthetic' } });
  const event = calls.find(call => call.sql.includes('INSERT INTO operational_incident_events'));
  assert.ok(event);
  const metadata = JSON.parse(event.values[4]);
  assert.deepEqual({ previousStatus: metadata.previousStatus, status: metadata.status,
    previousVersion: metadata.previousVersion, version: metadata.version },
  { previousStatus: 'open', status: 'contained', previousVersion: 2, version: 3 });
  assert.equal(metadata.assessment, 'synthetic');
});

test('incident creation acquires a transaction-scoped key lock before reading or inserting', async () => {
  const db = database();
  await createOperationalIncidentRepository(db).create({
    actorUserId: id, reference: 'FC-INC-LOCK', idempotencyKey: id,
    title: 'Synthetic concurrent incident', summary: 'Synthetic data only',
    severity: 'high', domain: 'marketplace',
  });
  const lockIndex = db.calls.findIndex(call => call.sql.includes('pg_advisory_xact_lock'));
  const lookupIndex = db.calls.findIndex(call => call.sql.includes('SELECT id FROM operational_incidents'));
  const insertIndex = db.calls.findIndex(call => call.sql.includes('INSERT INTO operational_incidents'));
  assert.equal(lockIndex, 0);
  assert.ok(lockIndex < lookupIndex && lookupIndex < insertIndex);
  assert.deepEqual(db.calls[lockIndex].values, [id]);
});
