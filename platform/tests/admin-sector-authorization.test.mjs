import assert from 'node:assert/strict';
import test from 'node:test';
import {ADMIN_SCOPE_SECTORS,hasSectorScope,requireSectorScope,staffSector} from '../apps/api/authorization.js';

const actor=(sector,level=4)=>({id:`actor-${sector}`,role:'admin',staffAccessLevel:level,staffSector:sector});

test('classic admin scopes require the matching explicit sector',()=>{
 assert.equal(hasSectorScope(actor('finance',3),'admin:finance:read'),true);
 assert.equal(hasSectorScope(actor('support',2),'admin:finance:read'),false);
 assert.equal(hasSectorScope(actor('logistics',4),'admin:deliveries:validate'),true);
 assert.equal(hasSectorScope(actor('operations',4),'admin:deliveries:validate'),false);
 assert.equal(hasSectorScope(actor('security',4),'admin:audit:read'),true);
 assert.equal(hasSectorScope(actor('legal_privacy',4),'admin:audit:read'),true);
 assert.throws(()=>requireSectorScope(actor('finance',3),'admin:security:write'),error=>error.code==='forbidden');
});

test('founder keeps full view while non-staff never inherits admin access',()=>{
 const founder=actor('founder',5);
 for(const scope of Object.keys(ADMIN_SCOPE_SECTORS))assert.equal(hasSectorScope(founder,scope),true);
 assert.equal(hasSectorScope({role:'customer',staffSector:'finance'},'admin:finance:read'),false);
});

test('legacy staff without a sector remains compatible until account regularization',()=>{
 const legacy={role:'admin',staffAccessLevel:4};
 assert.equal(staffSector(legacy),null);
 assert.equal(hasSectorScope(legacy,'admin:operations:read'),true);
});
