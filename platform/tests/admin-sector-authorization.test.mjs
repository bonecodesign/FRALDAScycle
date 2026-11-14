import assert from 'node:assert/strict';
import test from 'node:test';
import {ADMIN_SCOPE_SECTORS,hasAdminSector,hasSectorScope,requireAdminSector,requireSectorScope,staffSector} from '../apps/api/authorization.js';
import {requireAdminRouteSector} from '../apps/api/admin-handler.js';

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

test('legacy staff without a sector fails closed until account regularization',()=>{
 const legacy={role:'admin',staffAccessLevel:4};
 assert.equal(staffSector(legacy),null);
 assert.equal(hasSectorScope(legacy,'admin:operations:read'),false);
 assert.equal(hasAdminSector(legacy,['operations']),false);
 assert.throws(()=>requireSectorScope(legacy,'admin:operations:read'),error=>error.code==='staff_sector_required');
 assert.throws(()=>requireAdminSector(legacy,['operations'],4),error=>error.code==='staff_sector_required');
});

test('specialized admin routes combine their service level with a bounded sector',()=>{
 assert.equal(hasAdminSector(actor('finance',3),['finance']),true);
 assert.equal(hasAdminSector(actor('support',3),['finance']),false);
 assert.throws(()=>requireAdminSector(actor('support',3),['finance'],3),error=>error.code==='forbidden');
 assert.doesNotThrow(()=>requireAdminRouteSector(actor('finance',3),'/v1/admin/supported-cancellations'));
 assert.throws(()=>requireAdminRouteSector(actor('operations',4),'/v1/admin/supported-cancellations'),error=>error.code==='forbidden');
 assert.doesNotThrow(()=>requireAdminRouteSector(actor('support',1),'/v1/admin/courier-wallet-support'));
 assert.throws(()=>requireAdminRouteSector(actor('finance',3),'/v1/admin/courier-wallet-support'),error=>error.code==='forbidden');
 assert.doesNotThrow(()=>requireAdminRouteSector(actor('security',4),'/v1/admin/child-data-emergency-access'));
 assert.doesNotThrow(()=>requireAdminRouteSector(actor('founder',5),'/v1/admin/authority-requests'));
});
