import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('data export interface requires step-up and exposes only authenticated lifecycle routes',async()=>{const [html,script,settings]=await Promise.all([read('apps/app/data-export.html'),read('apps/app/data-export.js'),read('apps/app/settings.html')]);assert.match(settings,/href="\/app\/data-export"/);assert.match(html,/Senha da conta e do arquivo/);assert.match(html,/Código de 6 dígitos/);assert.match(script,/purpose:'data_export'/);assert.match(script,/step-up\/request/);assert.match(script,/step-up\/confirm/);assert.match(script,/credentials:'include'/);assert.match(script,/downloadAvailable/);assert.doesNotMatch(script,/localStorage|sessionStorage/);});
