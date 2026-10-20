import { checkAuthBrowser } from './auth-browser-check.mjs';
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
// The shared GitHub runner can pause a headless page while PostgreSQL-heavy
// scenarios are still active. Keep the assertion strict, but let the browser
// use half of the 10-minute Node test budget before declaring a transition
// absent. Local feedback remains capped at two minutes.
const browserWaitMs = process.env.CI ? 300000 : 120000;
const devtoolsWaitMs = process.env.CI ? 30000 : 12000;
async function until(operation, label) {
  const deadline = Date.now() + browserWaitMs;
  while (Date.now() < deadline) { if (await operation()) return; await pause(100); }
  throw new Error(`Browser check timed out: ${label}`);
}
export async function runBrowserBetaChecks({ surfaceOrigin, apiOrigin, sessionToken,loginFixture,authFixture,requestAuthCode,browserDonation,browserInstitution,browserReview,browserAddress,browserTransaction,adminOrigin,adminSessionToken }) {
  const executable = nativeChrome();
  if (!executable || typeof WebSocket === 'undefined') throw new Error('Chrome nativo e WebSocket necessários para validar navegador real.');
  const profile = await mkdtemp(join(tmpdir(), 'fraldacycle-chrome-'));
  const chrome = spawn(executable, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run', '--no-default-browser-check', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let socket;
  let requestClose = null;
  const pending = new Map();
  const networkRequests = new Map();
  const networkDiagnostics = [];
  const recordNetwork = entry => {
    networkDiagnostics.push(entry);
    if (networkDiagnostics.length > 40) networkDiagnostics.shift();
  };
  try {
    const endpoint = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Chrome DevTools não iniciou.')), devtoolsWaitMs);
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
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`DevTools timeout: ${method}`)); }, devtoolsWaitMs);
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
      } else if (message.method === 'Network.requestWillBeSent') {
        const request = message.params.request;
        const url = new URL(request.url);
        if (url.protocol === 'http:' && url.hostname === '127.0.0.1') {
          networkRequests.set(message.params.requestId, { url: url.origin + url.pathname, method: request.method });
        }
      } else if (message.method === 'Network.responseReceived') {
        const request = networkRequests.get(message.params.requestId);
        if (request) recordNetwork({ ...request, status: message.params.response.status });
      } else if (message.method === 'Network.loadingFailed') {
        const request = networkRequests.get(message.params.requestId);
        if (request) recordNetwork({ ...request, failed: message.params.errorText, blockedReason: message.params.blockedReason ?? null, canceled: message.params.canceled });
        networkRequests.delete(message.params.requestId);
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
      if (result.exceptionDetails) throw new Error(`Browser evaluation failed: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}; expression: ${expression.slice(0,240)}`);
      return result.result.value;
    };
    await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
    await call('Fetch.enable', { patterns: [{ urlPattern: 'http*', requestStage: 'Request' }] });
    const authentication = authFixture ? await checkAuthBrowser({call,evaluate,until,surfaceOrigin,apiOrigin,adminOrigin,fixture:authFixture,requestAuthCode}) : null;
    const loginLayouts=[];
    if(loginFixture){
      await call('Page.navigate',{url:`${surfaceOrigin}/app/login`});
      await until(()=>evaluate(`document.readyState==='complete'&&Boolean(document.getElementById('login-form'))`),'login form ready');
      assert.equal(await evaluate(`[...document.querySelectorAll('#login-form input')].every(input=>input.labels?.length>0)`),true);
      for(const width of [320,375,768,1280]){
        await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
        const layout=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth+1,missingLabels:[...document.querySelectorAll('#login-form input')].filter(input=>!input.labels?.length).length})`);
        assert.equal(layout.overflow,false,`Login overflow ${width}`);assert.equal(layout.missingLabels,0);loginLayouts.push({viewport:width,...layout});
      }
      await evaluate(`document.getElementById('login-contact').value=${JSON.stringify(loginFixture.email)};document.getElementById('login-password').value='synthetic-invalid-password';document.querySelector('#login-form button[type=submit]').focus()`);
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
      await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      await until(()=>evaluate(`Boolean(document.querySelector('#login-form .field-error')?.textContent)&&!document.querySelector('#login-form button[type=submit]').disabled`),'invalid password rejected');
      assert.equal(await evaluate('location.pathname'),'/app/login');
      assert.equal(await evaluate(`document.getElementById('login-password').value`),'');
      assert.equal(await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/auth/session')},{credentials:'include'}).then(response=>response.status)`),401);
      await evaluate(`document.getElementById('login-password').value=${JSON.stringify(loginFixture.password)};document.querySelector('#login-form button[type=submit]').focus()`);
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
      await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      await until(()=>evaluate(`location.pathname==='/app/home'`),'valid login navigates home');
      assert.equal(await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/auth/session')},{credentials:'include'}).then(response=>response.json()).then(result=>result.user?.id)`),loginFixture.userId);
      const cookies=await call('Network.getCookies',{urls:[apiOrigin]});
      assert.ok(cookies.cookies.some(cookie=>cookie.name==='fc_session'&&cookie.httpOnly));
    }
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
    await call('Page.navigate',{url:`${surfaceOrigin}/app/chat`});
    await until(()=>evaluate(`Boolean(document.getElementById('chat-form'))`),'chat document');
    await evaluate(`sessionStorage.setItem('fc.activeTransactionId',${JSON.stringify(browserTransaction)})`);
    await call('Page.reload');
    await until(()=>evaluate(`document.getElementById('msg')&&!document.getElementById('msg').disabled`),'authorized persisted chat');
    await evaluate(`document.getElementById('msg').value='O pacote está pronto para coleta.';document.querySelector('#chat-form button[type=submit]').focus()`);
    await key('Enter','Enter',13);
    try { await until(()=>evaluate(`document.getElementById('message-list').textContent.includes('O pacote está pronto para coleta.')`),'chat keyboard persistence'); }
    catch(error) { throw new Error(error.message+': '+JSON.stringify(await evaluate(`({error:document.getElementById('chat-error')?.textContent,gate:document.getElementById('chat-payment-gate')?.textContent,disabled:document.getElementById('msg')?.disabled,route:location.pathname})`))); }
    await evaluate(`document.getElementById('msg').value='fake@example.test';document.querySelector('#chat-form button[type=submit]').focus()`);
    await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('chat-error').textContent.includes('Conteúdo bloqueado')`),'chat contact block');
    await call('Page.navigate',{url:`${surfaceOrigin}/app/moderation`});
    await until(()=>evaluate(`document.getElementById('moderation-list')?.textContent.includes('Conteúdo identificado')`),'moderation private decision');
    await evaluate(`document.querySelector('#moderation-list button').focus()`);await key('Enter','Enter',13);
    assert.equal(await evaluate('document.activeElement.name'),'body');
    await evaluate(`document.querySelector('#moderation-appeal-form textarea').value='Solicito revisão do bloqueio fictício sem dados privados.';document.querySelector('#moderation-appeal-form button[type=submit]').focus()`);
    await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('moderation-feedback').textContent.includes('Contestação registrada')`),'appeal keyboard submission');
    const appealedDecision=await evaluate(`document.querySelector('#moderation-list p:nth-child(2)').textContent.replace('Registro: ','')`);
    const moderationLayouts=[];
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      const layout=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth+1,missingLabels:[...document.querySelectorAll('input,textarea')].filter(c=>c.type!=='hidden'&&!c.labels?.length&&!c.getAttribute('aria-label')&&!c.getAttribute('aria-labelledby')).length})`);
      assert.equal(layout.overflow,false,`Moderation overflow ${width}`);assert.equal(layout.missingLabels,0);moderationLayouts.push({viewport:width,...layout});
    }
    await call('Page.navigate',{url:`${surfaceOrigin}/app/address-changes`});
    await until(()=>evaluate(`document.getElementById('address-change-feedback')?.textContent.includes('Pedidos carregados')`),'address changes load');
    await evaluate(`document.querySelector('#address-change-load input').value=${JSON.stringify(browserAddress.shipmentId)};document.querySelector('#address-change-load button').focus()`);
    await key('Enter','Enter',13);
    await until(()=>evaluate(`!document.querySelector('#address-change-form fieldset').disabled`),'owned shared address');
    await evaluate(`(()=>{const f=document.getElementById('address-change-form');f.elements.addressId.value=${JSON.stringify(browserAddress.addressId)};f.elements.reason.value='Correção fictícia solicitada pelo titular no navegador.';f.elements.confirmed.focus();})()`);
    await key(' ','Space',32);await evaluate(`document.querySelector('#address-change-form button[type=submit]').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('address-change-feedback').textContent.includes('Pedido registrado — protocolo FC-S-')`),'address request keyboard');
    const addressRequest=await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/address-change-requests')},{credentials:'include'}).then(r=>r.json()).then(r=>r.items[0].id)`);
    const addressLayouts=[];
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      const layout=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth+1,missingLabels:[...document.querySelectorAll('input,textarea,select')].filter(c=>c.type!=='hidden'&&!c.labels?.length&&!c.getAttribute('aria-label')&&!c.getAttribute('aria-labelledby')).length})`);
      assert.equal(layout.overflow,false,`Address overflow ${width}`);assert.equal(layout.missingLabels,0);addressLayouts.push({viewport:width,...layout});
    }
    await call('Page.navigate',{url:`${surfaceOrigin}/app/privacy`});
    await until(()=>evaluate(`document.querySelector('#privacy-form fieldset')?.disabled===false&&document.getElementById('privacy-feedback')?.textContent.includes('Pedidos carregados')`),'privacy authenticated form');
    await evaluate(`(()=>{const f=document.getElementById('privacy-form');f.elements.kind.value='deletion';f.elements.details.value='Solicitação fictícia de exclusão no navegador, sem dados privados.';f.elements.confirmed.focus();})()`);
    await key(' ','Space',32);await evaluate(`document.querySelector('#privacy-form button[type=submit]').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('privacy-feedback').textContent.includes('Solicitação registrada — protocolo FC-S-')`),'privacy protocol via keyboard');
    const privacyRequest=await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/privacy-requests')},{credentials:'include'}).then(r=>r.json()).then(r=>r.items[0])`);
    assert.equal(privacyRequest.kind,'deletion');assert.equal(privacyRequest.erasureAllowed,false);assert.equal(privacyRequest.closureAllowed,false);
    await evaluate(`document.querySelector('#privacy-list button').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('privacy-detail').textContent.includes('Retenção: aguardando revisão')`),'privacy private obligations');
    const privacyLayouts=[];
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      const layout=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth+1,missingLabels:[...document.querySelectorAll('input,textarea,select')].filter(c=>c.type!=='hidden'&&!c.labels?.length&&!c.getAttribute('aria-label')&&!c.getAttribute('aria-labelledby')).length})`);
      assert.equal(layout.overflow,false,`Privacy overflow ${width}`);assert.equal(layout.missingLabels,0);privacyLayouts.push({viewport:width,...layout});
    }
    await call('Page.navigate',{url:`${surfaceOrigin}/app/review-moderation?reviewId=${browserReview.receivedId}`});
    await until(()=>evaluate(`!document.querySelector('#review-report-form fieldset')?.disabled`),'review report authenticated form');
    await evaluate(`(()=>{const f=document.getElementById('review-report-form');f.elements.category.value='fraud';f.elements.details.value='Solicito análise do risco fictício na avaliação.';f.elements.confirmed.focus();})()`);
    await key(' ','Space',32);await evaluate(`document.querySelector('#review-report-form button[type=submit]').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('review-mod-feedback').textContent.includes('Denúncia registrada — protocolo FC-S-')`),'review report via keyboard');
    await evaluate(`document.querySelector('#review-own-list button').focus()`);await key('Enter','Enter',13);
    await evaluate(`(()=>{const f=document.getElementById('review-visibility-appeal');f.elements.details.value='Solicito revisão da minha avaliação fictícia oculta.';f.elements.confirmed.focus();})()`);
    await key(' ','Space',32);await evaluate(`document.querySelector('#review-visibility-appeal button[type=submit]').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('review-mod-feedback').textContent.includes('Contestação registrada — protocolo FC-S-')`),'review author appeal keyboard');
    const reviewLayouts=[];
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      const layout=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth+1,missingLabels:[...document.querySelectorAll('input,textarea,select')].filter(c=>c.type!=='hidden'&&!c.labels?.length&&!c.getAttribute('aria-label')&&!c.getAttribute('aria-labelledby')).length})`);
      assert.equal(layout.overflow,false,`Review moderation overflow ${width}`);assert.equal(layout.missingLabels,0);reviewLayouts.push({viewport:width,...layout});
    }
    await call('Page.navigate',{url:`${surfaceOrigin}/app/institution-access`});
    await until(()=>evaluate(`document.getElementById('institution-access-feedback')?.textContent.includes('Vínculos carregados')`),'institution binding load');
    await evaluate(`document.querySelector('#institution-access-list button').focus()`);await key('Enter','Enter',13);
    assert.equal(await evaluate('document.activeElement.name'),'confirmed');
    await key(' ','Space',32);await evaluate(`document.querySelector('#institution-access-accept button[type=submit]')?.focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('institution-access-feedback').textContent.includes('Aceite registrado')`),'institution acceptance keyboard');
    const institutionLayouts=[];
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      const layout=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth+1,missingLabels:[...document.querySelectorAll('input,textarea,select')].filter(c=>c.type!=='hidden'&&!c.labels?.length&&!c.getAttribute('aria-label')&&!c.getAttribute('aria-labelledby')).length})`);
      assert.equal(layout.overflow,false,`Institution access overflow ${width}`);assert.equal(layout.missingLabels,0);institutionLayouts.push({viewport:width,...layout});
    }
    await call('Network.setCookie',{name:'fc_session',value:adminSessionToken,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'});
    await call('Page.navigate',{url:`${adminOrigin}/admin/moderation`});
    await until(()=>evaluate(`document.getElementById('moderation-admin-feedback')?.textContent.includes('Decisões carregadas')`),'admin moderation load');
    await evaluate(`(()=>{const article=[...document.querySelectorAll('#moderation-admin-list article')].find(a=>a.textContent.includes(${JSON.stringify(appealedDecision)}));article.querySelector('button').focus();})()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`!document.querySelector('#moderation-review-form fieldset').disabled`),'admin private appeal consultation');
    await evaluate(`(()=>{const f=document.getElementById('moderation-review-form');f.elements.reason.value='Contato fictício reconhecido; o bloqueio permanece aplicado.';f.elements.confirmed.focus();})()`);
    await key(' ','Space',32);await key('Tab','Tab',9);
    assert.equal(await evaluate(`document.activeElement.closest('form').id`),'moderation-review-form');
    await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('moderation-admin-feedback').textContent.includes('Revisão registrada')`),'admin keyboard appeal review');
    const reviewed=await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/moderation/decisions/')}+${JSON.stringify(appealedDecision)},{credentials:'include'}).then(r=>r.json()).then(r=>r.decision)`);
    assert.equal(reviewed.outcome,'upheld');assert.equal(reviewed.status,'upheld');
    const adminLayouts=[];
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      const layout=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth+1,missingLabels:[...document.querySelectorAll('input,textarea,select')].filter(c=>c.type!=='hidden'&&!c.labels?.length&&!c.getAttribute('aria-label')&&!c.getAttribute('aria-labelledby')).length})`);
      assert.equal(layout.overflow,false,`Admin moderation overflow ${width}`);assert.equal(layout.missingLabels,0);adminLayouts.push({viewport:width,...layout});
    }
    await call('Page.navigate',{url:`${surfaceOrigin}/app/address-changes`});
    await until(()=>evaluate(`!document.getElementById('address-change-review')?.hidden&&document.querySelector('#address-change-list button')`),'support address list');
    await evaluate(`document.querySelector('#address-change-list button').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`!document.querySelector('#address-change-review fieldset').disabled`),'authorized address consultation');
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,`Private address detail overflow ${width}`);
    }
    await evaluate(`(()=>{const f=document.getElementById('address-change-review');f.elements.outcome.value='approved';f.elements.reason.value='Conferência fictícia de consentimento, titular e retirada.';f.elements.confirmed.focus();})()`);
    await key(' ','Space',32);
    await evaluate(`document.querySelector('#address-change-review button[type=submit]').focus()`);
    await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('address-change-feedback').textContent.includes('Análise registrada')`),'support address approval keyboard');
    const addressDecision=await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/address-change-requests/')}+${JSON.stringify(addressRequest)},{credentials:'include'}).then(r=>r.json()).then(r=>r.request)`);
    assert.equal(addressDecision.status,'approved');assert.equal(addressDecision.current_revision,1);
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,`Support address overflow ${width}`);
    }
    await call('Page.navigate',{url:`${surfaceOrigin}/app/privacy`});
    await until(()=>evaluate(`!document.getElementById('privacy-assessment')?.hidden&&document.querySelector('#privacy-list button')`),'authorized privacy requests');
    await evaluate(`document.querySelector('#privacy-list button').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`!document.querySelector('#privacy-assessment fieldset').disabled`),'privacy support detail');
    await evaluate(`(()=>{const f=document.getElementById('privacy-assessment');f.elements.reason.value='Pendências fictícias conferidas, aguardando política de retenção.';f.elements.confirmed.focus();})()`);
    await key(' ','Space',32);await evaluate(`document.querySelector('#privacy-assessment button[type=submit]').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('privacy-feedback').textContent.includes('Análise registrada')`),'privacy keyboard assessment');
    const privacyAssessed=await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/privacy-requests/')}+${JSON.stringify(privacyRequest.id)},{credentials:'include'}).then(r=>r.json()).then(r=>r.request)`);
    assert.equal(privacyAssessed.status,'under_review');assert.equal(privacyAssessed.version,1);assert.equal(privacyAssessed.erasureAllowed,false);assert.equal(privacyAssessed.closureAllowed,false);
    await call('Page.navigate',{url:`${surfaceOrigin}/app/review-moderation`});
    await until(()=>evaluate(`document.getElementById('review-mod-admin')?.hidden===false&&document.getElementById('review-mod-feedback')?.textContent.includes('Avaliações carregadas')`),'review moderator list');
    await evaluate(`(()=>{const article=[...document.querySelectorAll('#review-mod-list article')].find(a=>a.textContent.includes(${JSON.stringify(browserReview.receivedId)}));article.querySelector('button').focus();})()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`!document.querySelector('#review-mod-decision fieldset').disabled`),'private reported review');
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,`Review moderator detail overflow ${width}`);
    }
    await evaluate(`(()=>{const f=document.getElementById('review-mod-decision');f.elements.outcome.value='public';f.elements.reason.value='Conferência fictícia não confirma risco da denúncia.';f.elements.confirmed.focus();})()`);
    await key(' ','Space',32);await evaluate(`document.querySelector('#review-mod-decision button[type=submit]').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('review-mod-feedback').textContent.includes('Decisão registrada')`),'review restoration keyboard');
    const reviewRestored=await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/admin/review-moderation/')}+${JSON.stringify(browserReview.receivedId)},{credentials:'include'}).then(r=>r.json()).then(r=>r.review)`);
    assert.equal(reviewRestored.visibility,'public');assert.equal(reviewRestored.visibility_version,2);
    await call('Page.navigate',{url:`${surfaceOrigin}/app/institution-access`});
    await until(()=>evaluate(`!document.getElementById('institution-access-admin')?.hidden&&document.getElementById('institution-access-feedback')?.textContent.includes('Vínculos carregados')`),'institution authorized review');
    await evaluate(`(()=>{const article=[...document.querySelectorAll('#institution-access-list article')].find(a=>a.textContent.includes('Aceito, aguardando conferência'));article.querySelector('button').focus();})()`);await key('Enter','Enter',13);
    await evaluate(`(()=>{const f=document.getElementById('institution-access-review');f.elements.outcome.value='verified';f.elements.reason.value='Conferência fictícia do vínculo aceita pelo representante.';f.elements.confirmed.focus();})()`);
    await key(' ','Space',32);await evaluate(`document.querySelector('#institution-access-review button[type=submit]').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('institution-access-feedback').textContent.includes('Conferência registrada')`),'institution verification keyboard');
    const institutionVerified=await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/institution-access')},{credentials:'include'}).then(r=>r.json()).then(r=>r.items.find(i=>i.institution_id===${JSON.stringify(browserInstitution)}))`);
    assert.equal(institutionVerified.status,'verified');assert.equal(institutionVerified.version,3);
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,`Institution reviewer overflow ${width}`);
    }
    const browserSupport=await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/support/tickets')},{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({category:'general',subject:'Atendimento fictício navegador',details:'Solicitação sintética para conferir a resposta administrativa por teclado.',idempotencyKey:'synthetic-browser-admin-support'})}).then(r=>r.json()).then(r=>r.ticket)`);
    assert.ok(browserSupport?.id);
    await call('Page.navigate',{url:`${adminOrigin}/admin/launch`});
    await until(()=>evaluate(`document.querySelectorAll('#support-rows button').length>0`),'admin support queue');
    await evaluate(`(()=>{document.getElementById('support-filter-status').value='open';document.getElementById('support-filter-category').value='general';document.getElementById('support-filter-query').value='Atendimento fictício navegador';document.getElementById('support-filter-form').requestSubmit();})()`);
    await until(()=>evaluate(`document.getElementById('support-status').textContent.includes('Página 1')&&[...document.querySelectorAll('#support-rows tr')].some(row=>row.textContent.includes('Atendimento fictício navegador'))`),'filtered admin support queue');
    await evaluate(`(()=>{const row=[...document.querySelectorAll('#support-rows tr')].find(row=>row.textContent.includes('Atendimento fictício navegador'));row.querySelector('button').focus();})()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.querySelector('#support-reply-form input[name=ticketId]').value===${JSON.stringify(browserSupport.id)}&&!document.querySelector('#support-reply-form button').disabled`),'admin selected support ticket');
    await evaluate(`(()=>{const button=document.querySelector('#support-assignment button');button.focus();})()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.querySelector('#support-assignment').textContent.includes('Responsável:')&&document.querySelector('#support-assignment button').textContent==='Liberar atribuição'`),'admin claims support ticket');
    await evaluate(`(()=>{document.getElementById('support-filter-assignment').value='mine';document.getElementById('support-filter-form').requestSubmit();})()`);
    await until(()=>evaluate(`[...document.querySelectorAll('#support-rows tr')].some(row=>row.textContent.includes('Atendimento fictício navegador'))`),'my assigned support queue');
    await evaluate(`(()=>{document.getElementById('support-filter-assignment').value='unassigned';document.getElementById('support-filter-form').requestSubmit();})()`);
    await until(()=>evaluate(`![...document.querySelectorAll('#support-rows tr')].some(row=>row.textContent.includes('Atendimento fictício navegador'))`),'unassigned support queue excludes claimed ticket');
    await evaluate(`(()=>{const button=document.querySelector('#support-assignment button');button.focus();})()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.querySelector('#support-assignment').textContent.includes('Sem responsável')&&document.querySelector('#support-assignment button').textContent==='Assumir atendimento'`),'admin releases own support assignment');
    const adminSupportLayouts=[];
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      const overflow=await evaluate(`document.documentElement.scrollWidth>innerWidth+1`);assert.equal(overflow,false,`Admin support overflow ${width}: `+JSON.stringify(await evaluate(`[...document.querySelectorAll('main *')].filter(node=>node.getBoundingClientRect().right>innerWidth+1).map(node=>({tag:node.tagName,id:node.id,class:node.className,right:node.getBoundingClientRect().right})).slice(0,12)`)));adminSupportLayouts.push({viewport:width,overflow});
    }
    await evaluate(`(()=>{const form=document.getElementById('support-reply-form');form.elements.body.value='Resposta fictícia para validação no navegador.';form.elements.status.value='under_review';form.querySelector('button').focus();})()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`!document.querySelector('#support-reply-form button').disabled&&document.getElementById('support-messages').textContent.includes('Resposta fictícia para validação no navegador.')`),'admin reply persisted and reloaded');
    const supportPersisted=await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/support/tickets/')}+${JSON.stringify(browserSupport.id)},{credentials:'include'}).then(r=>r.json()).then(r=>r.ticket)`);
    assert.equal(supportPersisted.status,'under_review');assert.equal(supportPersisted.messages.filter(message=>message.body==='Resposta fictícia para validação no navegador.').length,1);
    await call('Network.setCookie',{name:'fc_session',value:sessionToken,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'});
    await call('Page.navigate',{url:`${surfaceOrigin}/app/help`});
    await until(()=>evaluate(`document.readyState==='complete'&&Boolean(document.getElementById('support-form'))&&Boolean(sessionStorage.getItem('fc.supportDraftKey'))`),'client support form');
    await evaluate(`(()=>{const form=document.getElementById('support-form');form.elements.transaction.value='';form.elements.subject.value='Pedido fictício suporte cliente';form.elements.details.value='Descrição sintética para validar pedido e resposta operacional.';form.querySelector('button').focus();})()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('support-feedback')?.textContent.includes('Pedido registrado:')`),'client support created by keyboard');
    assert.equal(await evaluate(`document.querySelectorAll('#support-detail form').length`),0);
    const clientSupport=await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/support/tickets')},{credentials:'include'}).then(r=>r.json()).then(r=>r.items.find(ticket=>ticket.subject==='Pedido fictício suporte cliente'))`);assert.ok(clientSupport?.id);
    await evaluate(`document.getElementById('support-form').elements.transaction.value=${JSON.stringify(browserTransaction)};document.getElementById('operation-cancel').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('support-form').elements.category.value==='cancellation'&&!document.getElementById('operation-cancel').disabled`),'paid cancellation requires support');
    await evaluate(`document.getElementById('support-next').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('support-page').textContent==='Página 2'&&!document.getElementById('support-refresh').disabled`),'client support second page');
    assert.equal(await evaluate(`document.getElementById('support-form').elements.category.value`),'cancellation');
    await evaluate(`document.getElementById('support-previous').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('support-page').textContent==='Página 1'&&!document.getElementById('support-refresh').disabled`),'client support previous page');
    const sharedSupportLayouts=[];
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      const overflow=await evaluate(`document.documentElement.scrollWidth>innerWidth+1`);assert.equal(overflow,false,'Client support overflow '+width);sharedSupportLayouts.push({surface:'client',viewport:width,overflow});
    }
    await call('Network.setCookie',{name:'fc_session',value:adminSessionToken,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'});await call('Page.navigate',{url:`${adminOrigin}/admin/launch`});
    await until(()=>evaluate(`document.querySelectorAll('#support-rows button').length>0`),'admin returns to support queue');
    await evaluate(`([...document.querySelectorAll('#support-rows tr')].find(row=>row.textContent.includes('Pedido fictício suporte cliente')).querySelector('button').focus())`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.querySelector('#support-reply-form input[name=ticketId]').value===${JSON.stringify(clientSupport.id)}&&!document.getElementById('support-note-body').disabled`),'admin opens customer support detail');
    await evaluate(`(()=>{const form=document.getElementById('support-note-form');form.elements.body.value='Nota interna fictícia somente para a equipe.';form.querySelector('button').focus();})()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('support-note-status').textContent.includes('visível somente à equipe')&&document.getElementById('support-notes-list').textContent.includes('Nota interna fictícia somente para a equipe.')`),'admin internal note saved and rendered');
    const supportWithNote=await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/support/tickets/')}+${JSON.stringify(clientSupport.id)},{credentials:'include'}).then(r=>r.json()).then(r=>r.ticket)`);assert.equal(supportWithNote.internal_notes.length,1);assert.equal(supportWithNote.messages.some(message=>message.body==='Nota interna fictícia somente para a equipe.'),false);
    await call('Network.setCookie',{name:'fc_session',value:sessionToken,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'});
    const clientViewOfPrivateSupport=await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/support/tickets/')}+${JSON.stringify(clientSupport.id)},{credentials:'include'}).then(r=>r.json()).then(r=>r.ticket)`);assert.equal(Object.hasOwn(clientViewOfPrivateSupport,'internal_notes'),false);assert.equal(clientViewOfPrivateSupport.messages.some(message=>message.body==='Nota interna fictícia somente para a equipe.'),false);
    await call('Page.navigate',{url:`${surfaceOrigin}/app/help`});await until(()=>evaluate(`document.readyState==='complete'&&Boolean(document.getElementById('support-form'))&&Boolean(sessionStorage.getItem('fc.supportDraftKey'))`),'client support returns after privacy check');
    await call('Network.setCookie',{name:'fc_session',value:adminSessionToken,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'});
    await call('Page.navigate',{url:`${adminOrigin}/admin/operations`});
    await until(()=>evaluate(`document.readyState==='complete'&&Boolean(document.getElementById('support-refresh'))`),'operational support ready');
    await evaluate(`document.getElementById('support-refresh').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.querySelectorAll('#support-list button').length>0`),'operational support queue');
    await evaluate(`[...document.querySelectorAll('#support-list button')].find(button=>button.textContent.includes('Pedido fictício suporte cliente')).focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`Boolean(document.querySelector('#support-reply-form textarea'))`),'operational selected protocol');
    await evaluate(`window.fcOriginalSupportFetch=window.fetch;window.fetch=async(...args)=>{const result=await window.fcOriginalSupportFetch(...args);if(!window.fcSupportResponseDropped&&String(args[0]).endsWith('/v1/support/tickets/'+${JSON.stringify(clientSupport.id)}+'/reply')&&args[1]?.method==='POST'){window.fcSupportResponseDropped=true;throw new TypeError('Synthetic response loss');}return result;}`);
    await evaluate(`(()=>{const form=document.getElementById('support-reply-form');form.querySelector('textarea').value='Resposta operacional fictícia para conferir persistência.';form.querySelector('select').value='under_review';form.querySelector('button').focus();})()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('support-feedback').textContent.includes('Consulte o protocolo novamente')`),'support reply response lost after persistence');
    assert.equal(await evaluate(`Boolean(sessionStorage.getItem('fc.supportReplyKey:'+${JSON.stringify(clientSupport.id)}))`),true);
    await evaluate(`window.fetch=window.fcOriginalSupportFetch;[...document.querySelectorAll('#support-list button')].find(button=>button.textContent.includes('Pedido fictício suporte cliente')).focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`Boolean(document.querySelector('#support-reply-form textarea'))&&!document.querySelector('#support-reply-form button').disabled`),'support protocol reread before retry');
    await evaluate(`(()=>{const form=document.getElementById('support-reply-form');form.querySelector('textarea').value='Resposta operacional fictícia para conferir persistência.';form.querySelector('select').value='under_review';form.querySelector('button').focus();})()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('support-detail').textContent.includes('Resposta operacional fictícia para conferir persistência.')`),'operational reply persisted and reloaded');
    const clientSupportPersisted=await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/support/tickets/')}+${JSON.stringify(clientSupport.id)},{credentials:'include'}).then(r=>r.json()).then(r=>r.ticket)`);assert.equal(clientSupportPersisted.status,'under_review');assert.equal(clientSupportPersisted.messages.filter(message=>message.body==='Resposta operacional fictícia para conferir persistência.').length,1);
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      const overflow=await evaluate(`document.documentElement.scrollWidth>innerWidth+1`);assert.equal(overflow,false,'Operations support overflow '+width+' '+JSON.stringify(await evaluate(`[...document.querySelectorAll('main *')].filter(node=>node.getBoundingClientRect().right>innerWidth+1).map(node=>({tag:node.tagName,id:node.id,class:node.className,right:node.getBoundingClientRect().right})).slice(0,15)`)));sharedSupportLayouts.push({surface:'operations',viewport:width,overflow});
    }
    await call('Network.setCookie',{name:'fc_session',value:browserDonation.donorSessionToken,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'});
    await call('Page.navigate',{url:`${surfaceOrigin}/app/donations`});
    try { await until(()=>evaluate(`document.querySelector('#donation-create fieldset')?.disabled===false && document.getElementById('donation-feedback')?.textContent.includes('Doações carregadas')`),'donor own listing'); }
    catch(error){throw new Error(error.message+': '+JSON.stringify(await evaluate(`(async()=>({route:location.pathname,feedback:document.getElementById('donation-feedback')?.textContent,sessionStatus:await fetch(${JSON.stringify(apiOrigin+'/v1/auth/session')},{credentials:'include'}).then(r=>r.status),options:document.querySelector('#donation-create select')?.options.length}))()`)));}
    await evaluate(`document.querySelector('#donation-create input').focus()`);await key(' ','Space',32);await evaluate(`document.querySelector('#donation-create button[type=submit]').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('donation-feedback').textContent.includes('Confirmação do doador registrada')`),'donor confirmation keyboard');
    const browserDonationTransaction=await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/donations')},{credentials:'include'}).then(r=>r.json()).then(r=>r.items[0].transaction_id)`);
    await call('Network.setCookie',{name:'fc_session',value:sessionToken,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'});
    await call('Page.reload');await until(()=>evaluate(`document.getElementById('donation-feedback')?.textContent.includes('Doações carregadas')`),'representative donation load');
    await evaluate(`document.querySelector('#donation-list button').focus()`);await key('Enter','Enter',13);
    await evaluate(`document.querySelector('#donation-accept input').focus()`);await key(' ','Space',32);await evaluate(`document.querySelector('#donation-accept button[type=submit]').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('donation-feedback').textContent.includes('Confirmação institucional registrada')`),'institution donation confirmation keyboard');
    await call('Network.setCookie',{name:'fc_session',value:browserDonation.donorSessionToken,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'});
    await call('Page.reload');await until(()=>evaluate(`document.getElementById('donation-feedback')?.textContent.includes('Doações carregadas')`),'donor pickup load');
    await evaluate(`document.querySelector('#donation-list button').focus()`);await key('Enter','Enter',13);
    await evaluate(`document.querySelector('#donation-pickup input').focus()`);await key(' ','Space',32);await evaluate(`document.querySelector('#donation-pickup button[type=submit]').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('donation-feedback').textContent.includes('Retirada registrada')`),'donation pickup keyboard');
    await evaluate(`document.querySelector('#donation-list button').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`!document.querySelector('#donation-share fieldset').disabled`),'owned donation address');
    await evaluate(`document.querySelector('#donation-share input').focus()`);await key(' ','Space',32);await evaluate(`document.querySelector('#donation-share button[type=submit]').focus()`);await key('Enter','Enter',13);
    try { await until(()=>evaluate(`document.getElementById('donation-feedback').textContent.includes('Endereço compartilhado')`),'donation address consent keyboard'); }
    catch(error){throw new Error(error.message+': '+JSON.stringify(await evaluate(`({feedback:document.getElementById('donation-feedback')?.textContent,fieldsetDisabled:document.querySelector('#donation-share fieldset')?.disabled,addressCount:document.querySelector('#donation-share select[name=addressId]')?.options.length,addressId:document.querySelector('#donation-share select[name=addressId]')?.value,confirmed:document.querySelector('#donation-share input[name=confirmed]')?.checked,active:document.activeElement?.outerHTML})`)));}
    const browserDonationShipment=await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/donations/')}+${JSON.stringify(browserDonationTransaction)},{credentials:'include'}).then(r=>r.json()).then(r=>r.donation.shipment_id)`);
    const donationLayouts=[];
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      const layout=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth+1,missingLabels:[...document.querySelectorAll('input,textarea,select')].filter(c=>c.type!=='hidden'&&!c.labels?.length&&!c.getAttribute('aria-label')&&!c.getAttribute('aria-labelledby')).length})`);
      assert.equal(layout.overflow,false,`Donation overflow ${width}`);assert.equal(layout.missingLabels,0);donationLayouts.push({viewport:width,...layout});
    }
    await call('Network.setCookie',{name:'fc_session',value:browserDonation.courierSessionToken,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'});
    const assignedDonation=await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/shipments/')}+${JSON.stringify(browserDonationShipment)}+'/assign',{method:'POST',credentials:'include'}).then(r=>r.status)`);assert.equal(assignedDonation,200);
    await call('Page.navigate',{url:`${surfaceOrigin}/courier/home`});
    await until(()=>evaluate(`document.getElementById('courier-feedback')?.textContent.includes('Entregas carregadas')`),'assigned courier dashboard');
    assert.equal(await evaluate(`document.querySelectorAll('#courier-deliveries button').length`),2);
    const courierDashboardLayouts=[];
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      const overflow=await evaluate(`document.documentElement.scrollWidth>innerWidth+1`);assert.equal(overflow,false);courierDashboardLayouts.push({viewport:width,overflow});
    }
    await evaluate(`document.querySelectorAll('#courier-deliveries button')[1].focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`Boolean(document.getElementById('courier-contact'))&&!document.getElementById('courier-contact').disabled`),'courier details screen');
    await evaluate(`document.getElementById('courier-contact').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('courier-details-feedback').textContent.includes('Contato logístico indisponível')`),'donation contact unavailable before collection');
    assert.equal(await evaluate(`document.getElementById('courier-details').textContent.includes('+5500000000000')`),false);
    const courierDetailsLayouts=[];
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      const overflow=await evaluate(`document.documentElement.scrollWidth>innerWidth+1`);assert.equal(overflow,false);courierDetailsLayouts.push({viewport:width,overflow});
    }
    await evaluate(`document.getElementById('courier-payout').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('courier-details-feedback').textContent.includes('Consulta concluída')&&document.getElementById('courier-details').textContent.includes('Consulta informativa')`),'courier payout informational status');
    assert.equal(await evaluate(`document.getElementById('courier-details').textContent.includes('+5500000000000')`),false);
    assert.equal(await evaluate(`document.getElementById('courier-details').textContent.includes('Modalidade de operação sem repasse disponível')`),true);
    await call('Page.navigate',{url:`${surfaceOrigin}/courier/home`});
    await until(()=>evaluate(`document.getElementById('courier-feedback')?.textContent.includes('Entregas carregadas')`),'dashboard after details');
    await evaluate(`document.querySelector('#courier-deliveries button').focus()`);await key('Enter','Enter',13);

    await until(()=>evaluate(`Boolean(document.querySelector('#collection-form fieldset'))&&!document.querySelector('#collection-form fieldset').disabled`),'assigned courier collection form');
    assert.equal(await evaluate(`document.querySelector('#collection-form input[name=shipmentId]').value`),browserDonationShipment);
    await evaluate(`document.querySelector('#collection-form input[name=confirmed]').focus()`);
    await key(' ','Space',32);
    await evaluate(`document.querySelector('#collection-form button[type=submit]').focus()`);
    await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('collection-feedback').textContent.includes('Coleta registrada')`),'courier collection keyboard');
    assert.equal(await evaluate(`sessionStorage.getItem('fc.activeShipmentId')`),browserDonationShipment);
    assert.equal(await evaluate(`document.getElementById('collection-next').hidden`),false);
    // Stored media and geolocation are synthetic; the UI, API and database are real local services.
    await evaluate(`sessionStorage.setItem('fc.deliveryProofShipmentId',${JSON.stringify(browserDonationShipment)});sessionStorage.setItem('fc.deliveryProofMediaKey','synthetic/browser-donation-proof')`);
    await call('Page.navigate',{url:`${surfaceOrigin}/courier/job`});
    await until(()=>evaluate(`document.readyState==='complete'&&Boolean(document.getElementById('courier-contact'))&&!document.getElementById('courier-contact').disabled`),'details after collection');
    await evaluate(`document.getElementById('courier-contact').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('courier-details-feedback').textContent.includes('Consulta concluída')`),'delivery contact after collection');
    assert.equal(await evaluate(`document.getElementById('courier-details').textContent.includes('+5500000000000')`),true);
    assert.equal(await evaluate(`document.getElementById('courier-details').textContent.includes('Contato para entrega')`),true);
    await call('Page.navigate',{url:`${surfaceOrigin}/courier/proof`});

    await until(()=>evaluate(`document.readyState==='complete'&&Boolean(document.querySelector('[data-action="delivery"]'))`),'courier proof screen');
    const courierProofLayouts=[];
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      const layout=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth+1,missingLabels:[...document.querySelectorAll('.phone-content input')].filter(c=>!c.labels?.length).length})`);
      assert.equal(layout.overflow,false);assert.equal(layout.missingLabels,0);courierProofLayouts.push({viewport:width,...layout});
    }
    await evaluate(`document.getElementById('proof-recipient').value='Representante fictício';document.querySelector('.phone-content .terms input').checked=true;document.querySelector('[data-action="delivery"]').focus()`);
    await send('Browser.setPermission',{permission:{name:'geolocation'},setting:'denied',origin:surfaceOrigin});
    await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('toast').textContent.includes('Permita o acesso')&&!document.querySelector('[data-action="delivery"]').disabled`),'location denied preserves proof');
    assert.equal(await evaluate(`sessionStorage.getItem('fc.deliveryProofMediaKey')`),'synthetic/browser-donation-proof');
    await send('Browser.setPermission',{permission:{name:'geolocation'},setting:'granted',origin:surfaceOrigin});
    await call('Emulation.setGeolocationOverride',{latitude:0,longitude:0,accuracy:1});
    await evaluate(`document.querySelector('[data-action="delivery"]').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`location.pathname==='/courier/history'`),'proof accepted through courier UI');
    assert.equal(await evaluate(`sessionStorage.getItem('fc.deliveryProofMediaKey')`),null);
    await until(()=>evaluate(`document.getElementById('courier-feedback')?.textContent.includes('Histórico carregado')`),'courier history loads recorded delivery');
    assert.equal(await evaluate(`document.querySelectorAll('#courier-history-records .panel').length`),1);
    assert.equal(await evaluate(`document.querySelectorAll('#courier-history-records button').length`),0);
    assert.equal(await evaluate(`document.getElementById('courier-history-records').textContent.includes('Entrega registrada como entregue')`),true);
    assert.deepEqual(await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/courier/shipments')},{credentials:'include'}).then(r=>r.json()).then(r=>r.items)`),[]);
    const courierHistoryLayouts=[];
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      const overflow=await evaluate(`document.documentElement.scrollWidth>innerWidth+1`);assert.equal(overflow,false);courierHistoryLayouts.push({viewport:width,overflow});
    }
    await call('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
    await evaluate(`document.getElementById('courier-refresh').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('courier-feedback')?.textContent.includes('Não foi possível conectar')&&!document.getElementById('courier-refresh').disabled`),'offline history consultation allows retry');
    assert.equal(await evaluate(`document.querySelectorAll('#courier-history-records .panel').length`),0);
    assert.equal(await evaluate(`sessionStorage.getItem('fc.activeShipmentId')`),browserDonationShipment);
    await call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
    await evaluate(`document.getElementById('courier-refresh').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('courier-feedback')?.textContent.includes('Histórico carregado')`),'online history consultation recovers');
    assert.equal(await evaluate(`document.querySelectorAll('#courier-history-records .panel').length`),1);
    await call('Network.setCookie',{name:'fc_session',value:sessionToken,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'});
    await call('Page.navigate',{url:`${surfaceOrigin}/app/donations`});await until(()=>evaluate(`document.getElementById('donation-feedback')?.textContent.includes('Doações carregadas')`),'institution receipt load');
    await evaluate(`document.querySelector('#donation-list button').focus()`);await key('Enter','Enter',13);
    await evaluate(`document.querySelector('#donation-receipt input').focus()`);await key(' ','Space',32);await evaluate(`document.querySelector('#donation-receipt button[type=submit]').focus()`);await key('Enter','Enter',13);
    await until(()=>evaluate(`document.getElementById('donation-feedback').textContent.includes('Recebimento institucional aprovado')`),'institution receipt keyboard');
    const donationReady=await evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/shipments/')}+${JSON.stringify(browserDonationShipment)}+'/settlement-status',{credentials:'include'}).then(r=>r.json()).then(r=>r.settlement)`);assert.equal(donationReady.payoutAllowed,false);assert.equal(donationReady.operationalRequirementsMet,false);
    return { sharedSupportLayouts, sharedSupport:"pedido do cliente e resposta operacional por teclado; cancelamento pago exige suporte; sem reembolso", adminSupportLayouts, adminSupport:"consulta, atribuição/liberação, resposta e nota privada por teclado com API/PostgreSQL; cliente sem acesso à nota; sem cancelamento/reembolso", courierDetailsLayouts, courierDetails:"contato sintético autorizado e situação informativa do repasse consultados por teclado; sem repasse", courierQueryRecovery:"consulta offline remove cartões, preserva seleção e desbloqueia atualização; conexão restaurada recarrega histórico", courierHistoryLayouts, courierDashboardLayouts, courierProof:'localização recusada preserva foto; nova tentativa por teclado registra comprovante na API/PostgreSQL; foto e coordenadas são fixtures',courierProofLayouts, authentication, browser: version.product, login: loginFixture ? 'senha recusada sem sessão, senha válida via tela/teclado, sessão HttpOnly e conta persistida' : 'não executado', loginLayouts, keyboard: 'Space, Tab e Enter executados via navegador', preferences: 'carregar, salvar, consultar e recarregar com API/PostgreSQL', premium: 'escolha e cancelamento de renovação com teclado e persistência, cobrança desativada', donation:'doador, representante, retirada, endereço, coleta e aprovação com teclado; prova/mídia e entrega física são fixtures, zero repasse',donationLayouts,institutions:'aceite e conferência administrativa do vínculo com teclado, identidade fictícia',institutionLayouts,reviews:'denúncia, recurso do autor e restauração com teclado',reviewLayouts,privacy:'pedido de exclusão protocolado, consulta e análise autorizada com teclado; exclusão bloqueada',privacyLayouts,addressChange:'pedido e aprovação pelo suporte com teclado, versão e protocolo',addressLayouts,draftTerms: 'aceite indisponível', layouts, premiumLayouts,moderationLayouts,adminLayouts,adminModeration:'consulta e revisão administrativa com teclado e conta separada',moderation:'chat persistido, contato bloqueado e contestação protocolada via teclado', humanTest: false, screenReader: false, physicalDevices: false };
  } catch (error) {
    throw new Error(`${error.message}\\nLocal browser request diagnostics: ${JSON.stringify(networkDiagnostics)}`);
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
  try { console.log(JSON.stringify(await runBrowserBetaChecks({...JSON.parse(input),requestAuthCode: async (email,kind) => new Promise((resolve,reject)=>{
    const id=crypto.randomUUID();
    const timer=setTimeout(()=>{process.off("message",receive);reject(new Error("Código local indisponível"));},12000);
    const receive=message=>{if(message.id!==id)return;clearTimeout(timer);process.off("message",receive);message.error?reject(new Error(message.error)):resolve(message.code);};
    process.on("message",receive);process.send({id,email,kind});
  })}))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

if (process.connected) process.disconnect();
