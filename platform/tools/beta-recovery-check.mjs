import assert from 'node:assert/strict';
import { mkdtemp, chmod, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase } from '../database/client.js';
import { createBackupPlan, createRestorePlan, executePlan } from '../database/recovery.js';
import { spawnPostgresTestTool } from './native-postgres.mjs';

// Only called with the disposable cluster created by withNativeTestPostgres.
export async function validateSyntheticRecovery(database, databaseUrl, bin) {
  const source = new URL(databaseUrl);
  assert.equal(source.hostname, '127.0.0.1');
  assert.equal(source.pathname, '/postgres');
  const target = new URL(source);
  target.pathname = '/beta_restore';
  const directory = await mkdtemp(join(tmpdir(), 'fraldacycle-recovery-'));
  await chmod(directory, 0o700);
  const dump = join(directory, 'synthetic.dump');
  const env = { DATABASE_URL: source.toString(), RESTORE_DATABASE_URL: target.toString(),
    DATABASE_DUMP_PATH: dump, CONFIRM_DATABASE_RESTORE: 'RESTORE' };
  const spawnImpl = (command, args, options) => spawnPostgresTestTool(bin, command, args, options);
  let restored;
  async function snapshot(connection) {
    const tables = (await connection.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
    const result = {};
    for (const { tablename } of tables) {
      const identifier = '"' + tablename.replaceAll('"', '""') + '"';
      result[tablename] = (await connection.query('SELECT to_jsonb(t)::text AS row FROM public.' + identifier + ' t ORDER BY to_jsonb(t)::text')).rows.map(value => value.row);
    }
    const sequences = (await connection.query("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S' ORDER BY c.relname")).rows;
    result.__sequences = {};
    for (const { relname } of sequences) {
      const identifier = '"' + relname.replaceAll('"', '""') + '"';
      result.__sequences[relname] = (await connection.query('SELECT last_value::text, is_called FROM public.' + identifier)).rows[0];
    }
    return result;
  }
  try {
    const before = await snapshot(database);
    assert.ok(before.transactions.length > 0);
    assert.ok(before.audit_events.length > 0);
    assert.ok(before.schema_migrations.length > 0);
    // Restrict permissions before pg_dump opens the file, not after writing.
    const { writeFile } = await import('node:fs/promises');
    await writeFile(dump, '', { mode: 0o600, flag: 'wx' });
    await executePlan(createBackupPlan(env), { spawnImpl });
    assert.equal((await stat(dump)).mode & 0o777, 0o600);
    assert.ok((await stat(dump)).size > 0);
    await database.query('CREATE DATABASE beta_restore');
    restored = createDatabase({ databaseUrl: target.toString(), databaseSsl: false });
    await executePlan(createRestorePlan(env), { spawnImpl });
    assert.deepEqual(await snapshot(restored), before);
    assert.deepEqual(await snapshot(database), before);
    // Destroy only synthetic data in the separate restore database.
    await restored.query("UPDATE transactions SET amount_cents=amount_cents+1");
    assert.notDeepEqual(await snapshot(restored), before);
    assert.deepEqual(await snapshot(database), before);
    await executePlan(createRestorePlan(env), { spawnImpl });
    assert.deepEqual(await snapshot(restored), before);
    const { discoverMigrations, migrate } = await import('../database/migrate.js');
    await migrate(restored, await discoverMigrations());
    assert.deepEqual(await snapshot(restored), before);
    console.log('BETA_RECOVERY: pg_dump/pg_restore reais; todas as tabelas públicas, transações, auditoria e migrações iguais; segunda restauração e isolamento comprovados; arquivo temporário 0600.');
  } finally {
    if (restored) await restored.close();
    await rm(directory, { recursive: true, force: true });
  }
}
