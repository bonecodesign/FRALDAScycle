import { existsSync, openSync, closeSync } from 'node:fs';
import { readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';

const execute = promisify(execFile);
export async function nativePostgresTools() {
  let versions = [];
  try { versions = (await readdir('/usr/lib/postgresql')).sort((a, b) => Number(b) - Number(a)); } catch { /* Ambiente sem instalação nativa. */ }
  for (const version of versions) {
    const bin = `/usr/lib/postgresql/${version}/bin`;
    if (existsSync(`${bin}/initdb`) && existsSync(`${bin}/pg_ctl`)) return bin;
  }
  try {
    await docker('info','--format','{{.ServerVersion}}');
    return 'docker';
  } catch { return null; }
}
const dockerEnvironment={...process.env};
for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete dockerEnvironment[key];
const docker=(...args)=>execute('docker',['--host=unix:///var/run/docker.sock',...args],{env:dockerEnvironment,timeout:30000,maxBuffer:1024*1024});
let activeTestContainer;
export function spawnPostgresTestTool(bin,command,args,options) {
  if(bin!=='docker')return spawn(join(bin,command),args,options);
  if(!activeTestContainer||!['pg_dump','pg_restore'].includes(command))throw new Error('Ferramenta restrita ao contêiner temporário.');
  const adjusted=[...args];
  const fileIndex=command==='pg_dump'?adjusted.indexOf('--file')+1:adjusted.length-1;
  const descriptor=openSync(adjusted[fileIndex],command==='pg_dump'?'w':'r',0o600);
  if(command==='pg_dump')adjusted.splice(fileIndex-1,2);
  else adjusted.splice(fileIndex,1);
  const environment={...dockerEnvironment,...options.env,PGHOST:'127.0.0.1',PGPORT:'5432'};
  const flags=['exec','-i'];
  for(const key of ['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE'])flags.push('-e',key);
  let child;
  try {
    child=spawn('docker',['--host=unix:///var/run/docker.sock',...flags,activeTestContainer,command,...adjusted],{
      env:environment,shell:false,stdio:command==='pg_dump'?['ignore',descriptor,'inherit']:[descriptor,'inherit','inherit'],
    });
  } finally { closeSync(descriptor); }
  return child;
}
async function withDockerTestPostgres(operation) {
  const container=`fc-beta-test-${randomUUID()}`,password=randomUUID(),port=await freeLocalPort();
  let started=false;
  try {
    await docker('run','--rm','-d','--name',container,'--tmpfs','/var/lib/postgresql/data',
      '-p',`127.0.0.1:${port}:5432`,'-e','POSTGRES_USER=fraldacycle_test','-e',`POSTGRES_PASSWORD=${password}`,
      'postgres:16-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea');
    started=true;
    activeTestContainer=container;
    let ready=false;
    for(let attempt=0;attempt<30;attempt++) {
      try { await docker('exec',container,'pg_isready','-h','127.0.0.1','-U','fraldacycle_test');ready=true;break; }
      catch { await new Promise(resolve=>setTimeout(resolve,250)); }
    }
    if(!ready)throw new Error('PostgreSQL temporário indisponível.');
    return await operation(`postgresql://fraldacycle_test:${password}@127.0.0.1:${port}/postgres`);
  } finally { activeTestContainer=undefined;if(started)await docker('rm','--force',container); }
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
  if (bin === 'docker') return withDockerTestPostgres(operation);
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
