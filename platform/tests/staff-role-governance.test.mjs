import assert from 'node:assert/strict';
import test from 'node:test';
import {createAdminRepository} from '../database/admin-repository.js';

function repositoryFor(target){let writes=0;const repository=createAdminRepository({async transaction(work){return work({async query(sql){if(sql.startsWith('SELECT id, role'))return{rows:[target]};if(sql.startsWith('UPDATE users'))writes++;return{rows:[]};}});}});return{repository,writes:()=>writes};}

test('legacy role mutation cannot promote into or demote out of internal staff',async()=>{
 const customer=repositoryFor({id:'target',role:'customer',staff_access_level:null,staff_sector:null});
 await assert.rejects(customer.repository.changeUserRole({actorUserId:'founder',targetUserId:'target',role:'admin'}),error=>error.code==='staff_role_change_governed');
 assert.equal(customer.writes(),0);
 const staff=repositoryFor({id:'target',role:'moderator',staff_access_level:2,staff_sector:'support'});
 await assert.rejects(staff.repository.changeUserRole({actorUserId:'founder',targetUserId:'target',role:'customer'}),error=>error.code==='staff_role_change_governed');
 assert.equal(staff.writes(),0);
});
