import assert from 'node:assert/strict';
import test from 'node:test';
import {bootstrapFounder,FOUNDER_CONFIRMATION} from '../tools/bootstrap-founder.mjs';

const id='11111111-1111-4111-8111-111111111111';
function database({existing=null,role='admin'}={}){const calls=[];return{calls,async transaction(operation){return operation({async query(sql,values=[]){calls.push({sql,values});if(/SELECT id,role/.test(sql))return{rows:[{id,role,staff_access_level:4,disabled_at:null}]};if(/SELECT id FROM users WHERE staff_access_level=5/.test(sql))return{rows:existing?[{id:existing}]:[]};if(/UPDATE users SET role/.test(sql))return{rows:[{id,staff_access_level:5}]};if(/UPDATE sessions/.test(sql))return{rows:[{id:'session'}],rowCount:1};return{rows:[],rowCount:1};}});}};}

test('founder bootstrap is explicit, unique, audited and revokes sessions',async()=>{
 const db=database(),result=await bootstrapFounder(db,{userId:id,confirmation:FOUNDER_CONFIRMATION});assert.deepEqual(result,{userId:id,reused:false,sessionsRevoked:1,accessLevel:5});
 assert.ok(db.calls.some(call=>/pg_advisory_xact_lock/.test(call.sql)));assert.ok(db.calls.some(call=>/staff\.founder\.bootstrapped/.test(call.sql)));assert.ok(db.calls.some(call=>/UPDATE sessions SET revoked_at/.test(call.sql)));
 await assert.rejects(bootstrapFounder(database(),{userId:id,confirmation:'wrong'}),/Explicit confirmation/);
 await assert.rejects(bootstrapFounder(database({existing:'22222222-2222-4222-8222-222222222222'}),{userId:id,confirmation:FOUNDER_CONFIRMATION}),/already exists/);
});
