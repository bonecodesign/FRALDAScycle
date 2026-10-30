import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
test('staff access UI keeps proposal and founder decision behind separate step-up grants',async()=>{const [html,source]=await Promise.all([readFile(new URL('../apps/admin/operations.html',import.meta.url),'utf8'),readFile(new URL('../apps/admin/staff-access.js',import.meta.url),'utf8')]);assert.match(html,/id="staff-access-proposal"/);assert.match(html,/id="staff-access-decision"/);assert.match(html,/type="password"/);assert.match(source,/purpose:'staff_access_change'/);assert.match(source,/\/v1\/admin\/access-level-changes/);assert.match(source,/grantId:grant\.grantId/);assert.doesNotMatch(source,/localStorage|sessionStorage/);});
