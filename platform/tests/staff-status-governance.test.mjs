import assert from 'node:assert/strict';
import test from 'node:test';
import {createAdminRepository} from '../database/admin-repository.js';

function repositoryFor(target){let writes=0;const repository=createAdminRepository({async transaction(work){return work({async query(sql){if(sql.startsWith('SELECT id, role'))return{rows:[target]};if(sql.startsWith('UPDATE users'))writes++;return{rows:[]};}});}});return{repository,writes:()=>writes};}

test('legacy status mutation cannot suspend or reactivate internal staff',async()=>{
 for(const status of ['suspended','active']){
  const staff=repositoryFor({id:'target',role:'admin',staff_access_level:4,staff_sector:'operations',disabled_at:status==='active'?new Date():null});
  await assert.rejects(staff.repository.setUserStatus({actorUserId:'support',targetUserId:'target',status,reason:'Solicitação interna deve seguir aprovação graduada.'}),error=>error.code==='staff_status_change_governed');
  assert.equal(staff.writes(),0);
 }
});

test('founder status is protected from the legacy route',async()=>{
 const founder=repositoryFor({id:'founder',role:'admin',staff_access_level:5,staff_sector:'founder',disabled_at:null});
 await assert.rejects(founder.repository.setUserStatus({actorUserId:'admin',targetUserId:'founder',status:'suspended',reason:'Tentativa sintética bloqueada.'}),error=>error.code==='staff_status_change_governed');
 assert.equal(founder.writes(),0);
});
