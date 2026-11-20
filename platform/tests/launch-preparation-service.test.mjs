import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {createLaunchPreparationSnapshot,loadLaunchPreparationSnapshot} from '../apps/api/launch-preparation-service.js';
import {handleAdmin} from '../apps/api/admin-handler.js';

const source=JSON.parse(await readFile(new URL('../config/launch-preparation.v1.json',import.meta.url),'utf8'));

test('admin launch snapshot is fail-closed and contains only aggregate preparation data',async()=>{
  const result=await loadLaunchPreparationSnapshot();
  assert.deepEqual(result.summary,{areas:9,pendingRequirements:22,plannedTasks:37,requiredEvidence:37});
  assert.equal(result.pilotDecision,'NO-GO');
  assert.equal(result.launchAuthorized,false);
  assert.equal(result.areas[0].title,'Pagamentos, frete e troca');
  assert.deepEqual(Object.keys(result.areas[0]),[
    'id','order','title','status','pendingRequirements','plannedTasks','requiredEvidence',
  ]);
  assert.equal(JSON.stringify(result).includes('runbook'),false);
  assert.equal(JSON.stringify(result).includes('requiredRoles'),false);
  assert.equal(JSON.stringify(result).includes('Reference'),false);
});

test('admin launch snapshot rejects activation, evidence claims and incomplete coverage',()=>{
  for(const mutate of [
    value=>{value.allowsLaunch=true;},
    value=>{value.finalDecision.launchAuthorized=true;},
    value=>{value.areas[0].status='approved';},
    value=>{value.areas[0].evidenceReference='evidence';},
    value=>{value.areas.pop();},
    value=>{value.areas[1].requirementIds[0]=2;},
  ]){
    const changed=structuredClone(source);mutate(changed);
    assert.throws(()=>createLaunchPreparationSnapshot(changed),/launch_preparation_invalid/);
  }
});

test('launch admin interface renders safely from the authenticated read-only endpoint',async()=>{
  const [html,controller]=await Promise.all([
    readFile(new URL('../apps/admin/launch.html',import.meta.url),'utf8'),
    readFile(new URL('../apps/admin/launch-preparation.js',import.meta.url),'utf8'),
  ]);
  assert.match(html,/Etapas restantes verificadas/);
  assert.match(html,/launch-preparation-status/);
  assert.match(controller,/\/v1\/admin\/launch-preparation/);
  assert.match(controller,/replaceChildren/);
  assert.doesNotMatch(controller,/innerHTML|insertAdjacentHTML|setTimeout/);
  assert.match(controller,/estado seguro permanece NO-GO/);
});

test('authenticated admin route exposes the snapshot without cache and rejects customers',async()=>{
  const users={admin:{id:'admin-1',role:'admin'},customer:{id:'customer-1',role:'customer'}};
  const authService={async session(token){return users[token]??null;}};
  const call=async token=>{
    const request=Readable.from([]);request.method='GET';request.headers={cookie:`fc_session=${token}`};
    const response={status:0,headers:{},body:'',writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}};
    const handled=await handleAdmin(request,response,{
      url:new URL('http://localhost/v1/admin/launch-preparation'),headers:{},requestId:'launch-test',
      authService,adminService:null,
    });
    return {handled,response,payload:JSON.parse(response.body)};
  };
  await assert.rejects(call('customer'),error=>error.code==='insufficient_access_level');
  const result=await call('admin');
  assert.equal(result.handled,true);
  assert.equal(result.response.status,200);
  assert.equal(result.response.headers['cache-control'],'no-store');
  assert.equal(result.payload.requestId,'launch-test');
  assert.equal(result.payload.pilotDecision,'NO-GO');
  assert.equal(result.payload.launchAuthorized,false);
});
