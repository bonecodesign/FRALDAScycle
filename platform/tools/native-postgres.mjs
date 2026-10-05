import { existsSync } from 'node:fs';
import { readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';

const execute = promisify(execFile);
export async function nativePostgresTools() {
  let versions = [];
  try { versions = (await readdir('/usr/lib/postgresql')).sort((a, b) => Number(b) - Number(a)); } catch { /* Ambiente sem instalação nativa. */ }
  for (const version of versions) {
    const bin = `/usr/lib/postgresql/${version}/bin`;
    if (existsSync(`${bin}/initdb`) && existsSync(`${bin}/pg_ctl`)) return bin;
  }
  return null;
}
export async function freeLocalPort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
export async function withNativeTestPostgres(operation) {
  const bin = await nativePostgresTools();
  if (!bin) throw new Error('PostgreSQL nativo necessário para validar a beta; não substituir por banco simulado.');
  const directory = await mkdtemp(join(tmpdir(), 'fraldacycle-postgres-'));
  const data = join(directory, 'data');
  const port = await freeLocalPort();
  let started = false;
  try {
    await execute(`${bin}/initdb`, ['-D', data, '--auth=trust', '--username=fraldacycle_test', '--no-locale', '--encoding=UTF8'], { timeout: 30000 });
    await execute(`${bin}/pg_ctl`, ['-D', data, '-l', join(directory, 'postgres.log'), '-w', 'start', '-o', `-h 127.0.0.1 -p ${port} -k ${directory}`], { timeout: 30000 });
    started = true;
    return await operation(`postgresql://fraldacycle_test@127.0.0.1:${port}/postgres`);
  } finally {
    if (started) await execute(`${bin}/pg_ctl`, ['-D', data, '-m', 'fast', '-w', 'stop'], { timeout: 30000 });
    await rm(directory, { recursive: true, force: true });
  }
}
