import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('account closure interface uses purpose-bound step-up and preserves cancellation window',async()=>{const [html,script,privacy]=await Promise.all([read('apps/app/account-closure.html'),read('apps/app/account-closure.js'),read('apps/app/privacy.js')]);assert.match(privacy,/\/app\/account-closure/);assert.match(html,/7 dias/);assert.match(html,/não é apagada imediatamente/i);assert.match(script,/purpose:'account_closure'/);assert.match(script,/FC-ACCOUNT-CLOSURE-1/);assert.match(script,/expectedVersion:current.version/);assert.doesNotMatch(script,/localStorage|sessionStorage/);});
