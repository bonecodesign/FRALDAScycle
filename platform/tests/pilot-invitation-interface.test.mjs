import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const adminHtml=await readFile(new URL('../apps/admin/pilot-invitations.html',import.meta.url),'utf8');
const adminScript=await readFile(new URL('../apps/admin/pilot-invitations.js',import.meta.url),'utf8');
const auth=await readFile(new URL('../apps/app/auth.js',import.meta.url),'utf8');

test('admin interface makes no delivery claim and exposes the token only in the issue result area',()=>{
  assert.match(adminHtml,/não envia e-mail nem abre o piloto/i);
  assert.match(adminHtml,/Token exibido uma única vez/);
  assert.doesNotMatch(adminScript,/localStorage|sessionStorage/);
  assert.match(adminScript,/result\.token/);
});

test('admin interface lists, issues and revokes through protected server routes',()=>{
  assert.match(adminScript,/\/v1\/admin\/pilot-invitations\?limit=50/);
  assert.match(adminScript,/method:'POST'/);
  assert.match(adminScript,/\/revoke/);
  assert.match(adminHtml,/role="status" aria-live="polite"/);
});

test('registration injects an optional one-time invitation without persisting it in browser storage',()=>{
  assert.match(auth,/name="pilotInvitationToken"/);
  assert.match(auth,/autocomplete="one-time-code"/);
  assert.match(auth,/pilotInvitationToken/);
  assert.doesNotMatch(auth,/setItem\([^\n]*pilotInvitationToken/);
});
