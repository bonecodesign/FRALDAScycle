import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { isMainModule } from '../packages/contracts/main-module.js';

export function nativeChrome() {
  return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync) ?? null;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(operation, label) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) { if (await operation()) return; await pause(100); }
  throw new Error(`Browser check timed out: ${label}`);
}
export async function runBrowserBetaChecks({ surfaceOrigin, apiOrigin, sessionToken }) {
  const executable = nativeChrome();
  if (!executable || typeof WebSocket === 'undefined') throw new Error('Chrome nativo e WebSocket necessários para validar navegador real.');
  const profile = await mkdtemp(join(tmpdir(), 'fraldacycle-chrome-'));
  const chrome = spawn(executable, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run', '--no-default-browser-check', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let socket;
  let requestClose = null;
  const pending = new Map();
  try {
    const endpoint = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Chrome DevTools não iniciou.')), 12000);
      chrome.once('error', error => { clearTimeout(timer); reject(error); });
      chrome.once('exit', () => { clearTimeout(timer); reject(new Error('Chrome encerrou antes da validação.')); });
      chrome.stderr.on('data', data => {
        const match = data.toString().match(/DevTools listening on (ws:\/\/127\.0\.0\.1:[^\s]+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', () => reject(new Error('DevTools connection failed')), { once: true }); });
    let sequence = 0;
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`DevTools timeout: ${method}`)); }, 12000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    requestClose = () => send('Browser.close');
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const operation = pending.get(message.id);
        if (!operation) return;
        clearTimeout(operation.timer); pending.delete(message.id);
        if (message.error) operation.reject(new Error(message.error.message)); else operation.resolve(message.result);
      } else if (message.method === 'Fetch.requestPaused') {
        const url = new URL(message.params.request.url);
        const allowed = url.protocol === 'http:' && url.hostname === '127.0.0.1';
        void send(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', { requestId: message.params.requestId, ...(allowed ? {} : { errorReason: 'BlockedByClient' }) }, message.sessionId).catch(() => {});
      }
    });
    const version = await send('Browser.getVersion');
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const call = (method, params) => send(method, params, sessionId);
    const evaluate = async expression => {
      const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error('Browser evaluation failed: ' + result.exceptionDetails.text);
      return result.result.value;
    };
    await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
    await call('Fetch.enable', { patterns: [{ urlPattern: 'http*', requestStage: 'Request' }] });
    await call('Network.setCookie', { name: 'fc_session', value: sessionToken, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' });
    await call('Page.navigate', { url: `${surfaceOrigin}/app/notification-settings` });
    await until(() => evaluate(`Boolean(document.querySelector('#operational-preferences-form fieldset:not([disabled])'))`), 'authenticated preferences load');
    const key = async (name, code, virtual) => {
      await call('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: virtual, nativeVirtualKeyCode: virtual, ...(name === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
      await call('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: virtual, nativeVirtualKeyCode: virtual });
    };
    await evaluate(`document.querySelector('#operational-preferences-form input[name=email]').focus()`);
    await key(' ', 'Space', 32);
    assert.equal(await evaluate(`document.querySelector('#operational-preferences-form input[name=email]').checked`), true);
    await key('Tab', 'Tab', 9);
    assert.equal(await evaluate('document.activeElement.name'), 'sms');
    await key('Tab', 'Tab', 9);
    assert.equal(await evaluate('document.activeElement.name'), 'push');
    await key('Tab', 'Tab', 9);
    assert.equal(await evaluate('document.activeElement.name'), 'quietEnabled');
    await key(' ', 'Space', 32);
    assert.equal(await evaluate(`document.getElementById('quiet-hours-schedule').disabled`), false);
    await key('Tab', 'Tab', 9);
    assert.equal(await evaluate('document.activeElement.name'), 'start');
    await evaluate(`(() => { const f=document.getElementById('operational-preferences-form'); f.elements.start.value='22:00'; f.elements.end.value='08:00'; f.elements.timeZone.value='UTC'; f.querySelector('button[type=submit]').focus(); })()`);
    await key('Enter', 'Enter', 13);
    try {
      await until(() => evaluate(`document.getElementById('operational-feedback').textContent.includes('Preferências registradas')`), 'keyboard submit');
    } catch (error) {
      const diagnostic = await evaluate(`(() => { const f=document.getElementById('operational-preferences-form'); return { feedback:document.getElementById('operational-feedback').textContent, disabled:f.querySelector('fieldset').disabled, invalid:[...f.elements].filter(c=>c.validity&&!c.validity.valid).map(c=>({name:c.name,message:c.validationMessage})), focused:document.activeElement.tagName }; })()`);
      throw new Error(error.message + ': ' + JSON.stringify(diagnostic));
    }
    const preferences = await evaluate(`fetch(${JSON.stringify(apiOrigin + '/v1/account/operational-preferences')},{credentials:'include'}).then(r=>r.json()).then(r=>r.preferences)`);
    assert.equal(preferences.version, 1);
    assert.equal(preferences.channels.email, true);
    assert.deepEqual(preferences.quietHours, { enabled: true, start: '22:00', end: '08:00', timeZone: 'UTC' });
    await evaluate(`document.getElementById('operational-refresh').focus()`);
    await key('Enter', 'Enter', 13);
    await until(() => evaluate(`document.getElementById('operational-feedback').textContent.includes('Preferências operacionais carregadas')`), 'reload');
    assert.equal(await evaluate(`document.querySelector('#operational-preferences-form input[name=email]').checked`), true);
    const layouts = [];
    for (const width of [320, 375, 768, 1280]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
      const layout = await evaluate(`(() => { const f=document.getElementById('operational-preferences-form'); const controls=[...f.querySelectorAll('input,button')]; return { width:innerWidth, overflow:document.documentElement.scrollWidth>innerWidth+1, missingLabels:controls.filter(c=>c.tagName==='INPUT'&&!c.labels.length).length, visible:controls.every(c=>c.getBoundingClientRect().width>0), bounded:controls.every(c=>{ const r=c.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1; }), formWidth:f.getBoundingClientRect().width }; })()`);
      assert.equal(layout.missingLabels, 0);
      assert.equal(layout.visible, true);
      assert.equal(layout.bounded, true, `Clipped control at viewport ${width}`);
      assert.equal(layout.overflow, false, `Horizontal overflow at viewport ${width}`);
      layouts.push({ viewport: width, ...layout });
    }
    await evaluate(`document.getElementById('terms-load').click()`);
    await until(() => evaluate(`document.getElementById('terms-content').textContent.includes('rascunho')`), 'draft terms');
    assert.equal(await evaluate(`document.getElementById('terms-accept-form').hidden`), true);
    await call('Page.navigate', { url: `${surfaceOrigin}/app/premium` });
    await until(() => evaluate(`document.getElementById('premium-feedback')?.textContent.includes('Plano e anúncios carregados')`), 'premium load');
    await evaluate(`document.querySelector('#premium-choice-form input').focus()`);
    await key(' ', 'Space', 32);
    await evaluate(`document.querySelector('#premium-choice-form button[type=submit]').focus()`);
    await key('Enter', 'Enter', 13);
    await until(() => evaluate(`document.getElementById('premium-feedback').textContent.includes('Escolha registrada')`), 'premium choice keyboard submit');
    await evaluate(`document.querySelector('#premium-cancel-form input').focus()`);
    await key(' ', 'Space', 32);
    await key('Tab', 'Tab', 9);
    assert.equal(await evaluate(`document.activeElement.closest('form').id`), 'premium-cancel-form');
    await key('Enter', 'Enter', 13);
    await until(() => evaluate(`document.getElementById('premium-feedback').textContent.includes('Próxima renovação cancelada')`), 'premium cancellation');
    assert.equal(await evaluate(`document.getElementById('premium-cancel-form').hidden`), true);
    const plan = await evaluate(`fetch(${JSON.stringify(apiOrigin + '/v1/account/premium')},{credentials:'include'}).then(r=>r.json()).then(r=>r.premium)`);
    assert.equal(plan.state, 'active'); assert.equal(plan.renewalEnabled, false); assert.equal(plan.choice.selectedIds.length, 1); assert.equal(plan.billingAllowed, false);
    const premiumLayouts = [];
    for (const width of [320,375,768,1280]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
      const layout = await evaluate(`(() => { const controls=[...document.querySelectorAll('input,button')].filter(c=>c.getBoundingClientRect().width>0); return { overflow:document.documentElement.scrollWidth>innerWidth+1, bounded:controls.every(c=>{const r=c.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;}),missingLabels:controls.filter(c=>c.tagName==='INPUT'&&!c.labels.length).length }; })()`);
      assert.equal(layout.overflow,false,`Premium overflow ${width}`); assert.equal(layout.bounded,true); assert.equal(layout.missingLabels,0);
      premiumLayouts.push({viewport:width,...layout});
    }
    return { browser: version.product, keyboard: 'Space, Tab e Enter executados via navegador', preferences: 'carregar, salvar, consultar e recarregar com API/PostgreSQL', premium: 'escolha e cancelamento de renovação com teclado e persistência, cobrança desativada', draftTerms: 'aceite indisponível', layouts, premiumLayouts, humanTest: false, screenReader: false, physicalDevices: false };
  } finally {
    if (requestClose && chrome.exitCode === null && chrome.signalCode === null) await Promise.race([requestClose().catch(() => {}), pause(2000)]);
    for (const operation of pending.values()) { clearTimeout(operation.timer); operation.reject(new Error('Browser closed')); }
    if (socket) socket.close();
    if (chrome.exitCode === null && chrome.signalCode === null) {
      const stopped = new Promise(resolve => chrome.once('exit', resolve));
      try { process.kill(-chrome.pid, 'SIGTERM'); } catch { /* Grupo já encerrado. */ }
      await Promise.race([stopped, pause(1000)]);
      if (chrome.exitCode === null && chrome.signalCode === null) { try { process.kill(-chrome.pid, 'SIGKILL'); } catch { /* Grupo já encerrado. */ } await stopped; }
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
if (isMainModule(import.meta.url)) {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  try { console.log(JSON.stringify(await runBrowserBetaChecks(JSON.parse(input)))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
