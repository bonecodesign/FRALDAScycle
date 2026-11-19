import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
test('operations shows guarded support duty governance, never an active shift or dispatch',async()=>{
 const html=await readFile(new URL('../apps/admin/operations.html',import.meta.url),'utf8');
 const script=await readFile(new URL('../apps/admin/support-duty.js',import.meta.url),'utf8');
 assert.match(html,/id="support-duty-panel" hidden/);
 assert.match(html,/id="support-duty-proposal-form"[^>]*hidden/);
 assert.match(html,/src="\/apps\/admin\/support-duty.js"/);
 assert.match(html,/Proposta.*nível 3.*revisão independente nível 4.*fundador nível 5.*aceite pessoal/);
 assert.match(script,/purpose:'support_duty_assignment'/);
 assert.match(script,/realStaffingActive!==false/);
 assert.match(script,/externalDispatchAuthorized!==false/);
 assert.match(script,/automaticPauseAuthorized!==false/);
 assert.match(script,/textContent=contents/);
 assert.doesNotMatch(script,/notification_outbox|sendPush|sendEmail|pauseOperations|automaticPause\s*=/);
});
