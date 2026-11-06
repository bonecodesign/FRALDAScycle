import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createAdminService} from '../apps/api/admin-service.js';

test('new internal invitations require an approved sector before persistence',async()=>{
 let received;
 const service=createAdminService({async createInvitation(input){received=input;return{id:'invite'};}});
 const actor={id:'founder',role:'admin',staffAccessLevel:5,staffSector:'founder'};
 await assert.rejects(service.createInvitation(actor,{email:'staff@example.com',displayName:'Pessoa interna',role:'admin'}),error=>error.code==='invalid_staff_sector');
 await service.createInvitation(actor,{email:'staff@example.com',displayName:'Pessoa interna',role:'admin',staffSector:'technical'});
 assert.equal(received.staffSector,'technical');
});

test('database policy preserves legacy history but rejects new incomplete staff invitations',async()=>{
 const sql=await readFile(new URL('../database/migrations/137_staff_invitation_sector_required.sql',import.meta.url),'utf8');
 assert.match(sql,/staff_access_level IS NOT NULL AND staff_sector IS NOT NULL/);
 assert.match(sql,/staff_access_level IS NULL AND staff_sector IS NULL/);
 assert.match(sql,/NOT VALID/);
 assert.doesNotMatch(sql,/DELETE|DROP|UPDATE admin_invitations/i);
});
