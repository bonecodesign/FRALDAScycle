import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createDatabase} from '../database/client.js';
import {freeLocalPort} from './native-postgres.mjs';

const execute=promisify(execFile);
const root=fileURLToPath(new URL('../',import.meta.url));
const container=`fc-listing-test-${randomUUID()}`;
const dockerEnvironment={...process.env};
for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete dockerEnvironment[key];
const docker=(...args)=>execute('docker',['--host=unix:///var/run/docker.sock',...args],{env:dockerEnvironment,timeout:120000,maxBuffer:1024*1024});
const image='postgres:16-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea';
let started=false;
try{
  await docker('info','--format','{{.ServerVersion}}');
  const port=await freeLocalPort();
  const password=randomUUID();
  await docker('run','--rm','-d','--name',container,'--label','fraldacycle.codex-test=listing-creation','--tmpfs','/var/lib/postgresql/data',
    '-p',`127.0.0.1:${port}:5432`,'-e','POSTGRES_DB=fc_listing_creation_test','-e','POSTGRES_USER=fc_test','-e',`POSTGRES_PASSWORD=${password}`,image);
  started=true;
  const databaseUrl=`postgresql://fc_test:${password}@127.0.0.1:${port}/fc_listing_creation_test`;
  const database=createDatabase({databaseUrl,databaseSsl:false});
  try{
    let ready=false;
    for(let attempt=0;attempt<20;attempt++){
      try{await database.readiness();ready=true;break}catch{await new Promise(resolve=>setTimeout(resolve,500))}
    }
    if(!ready)throw new Error('O PostgreSQL temporário não ficou disponível.');
  }finally{await database.close()}
  console.log('Validando migrações, publicação, MFA e recuperação concorrentes em PostgreSQL temporário.');
  const result=await execute(process.execPath,['--test','--test-concurrency=1','tests/listing-creation-postgres.test.mjs','tests/admin-mfa-postgres.test.mjs','tests/password-recovery-postgres.test.mjs','tests/notification-token-postgres.test.mjs','tests/account-verification-postgres.test.mjs','tests/chat-payment-postgres.test.mjs','tests/monthly-pricing-postgres.test.mjs','tests/pilot-bh-http-postgres.test.mjs'],{
    cwd:root,env:{...process.env,FC_LISTING_TEST_DATABASE_URL:databaseUrl},timeout:90000,maxBuffer:1024*1024,
  });
  process.stdout.write(result.stdout);
}catch(error){
  // Child-process arguments may contain the temporary database password.
  if(error.stdout)process.stdout.write(error.stdout);
  console.error('Validação PostgreSQL falhou. Confira Docker e o resultado do teste acima.');
  process.exitCode=1;
}finally{
  if(started){
    try{await docker('rm','--force',container);console.log('Banco temporário removido.')}catch{console.error(`Não foi possível remover o container temporário ${container}.`);process.exitCode=1}
  }
}
