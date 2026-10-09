import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../apps/app/auth.js', import.meta.url), 'utf8');
const start = source.indexOf('function setupAuthValidation()'), end = source.indexOf('\nsetupAuthValidation();');
assert.ok(start >= 0 && end > start);
class ApiError extends Error { constructor(code, message, status) { super(message); Object.assign(this, { code, status }); } }
function fixture(id, request, stored = {}) {
  const input = value => ({ value, checked: true, handlers: {}, classList: { toggle() {} }, checkValidity() { return true; }, focus() {}, addEventListener(name, callback) { this.handlers[name] = callback; } });
  const fields = { 'login-form': ['active@example.test','synthetic-password'], 'register-form': ['Pessoa fictícia','active@example.test','synthetic-password','synthetic-password','',''],
    'recovery-form': ['active@example.test'], 'reset-password-form': ['new-synthetic-password','new-synthetic-password'], 'verify-form': Array(6).fill('') };
  const inputs = fields[id].map(input), error = { textContent: '' }, button = { disabled: false, textContent: 'Continuar' };
  const resend = { disabled: false, handlers: {}, addEventListener(name, callback) { this.handlers[name] = callback; } };
  const form = { id, handlers: {}, querySelector(selector) {
    if (selector === '.field-error') return error;
    if (selector === '.terms') return { insertAdjacentHTML() {} };
    if (selector === 'input') return inputs[0];
    if (selector === '[type="submit"]') return button;
    if (selector === '.otp-time') return { textContent: '' };
    return null;
  }, querySelectorAll() { return inputs; }, addEventListener(name, callback) { this.handlers[name] = callback; } };
  const storage = new Map(Object.entries(stored)), calls = [], notices = [], location = { pathname: '/initial' };
  const api = async (path, options) => { calls.push([path,options]); return request(path,options); };
  const setup = new Function('document','apiRequest','ApiError','sessionStorage','location','notify', `${source.slice(start,end)}\nsetupAuthValidation();`);
  setup({ getElementById: name => name === id ? form : id === 'verify-form' && name === 'resend-code' ? resend : null }, api, ApiError,
    { getItem: key => storage.get(key) ?? null, setItem: (key,value) => storage.set(key,String(value)), removeItem: key => storage.delete(key) }, location, message => notices.push(message));
  const fire = (target = form, event = 'submit') => target.handlers[event]({ preventDefault() {}, currentTarget: target });
  return { form, inputs, error, button, resend, storage, calls, location, notices, fire,
    code() { inputs.forEach((field,index) => { field.value = String(index+1); }); } };
}
const challenge = 'a'.repeat(43);

test('client login blocks duplicate requests and sends MFA accounts to administrative login', async () => {
  let finish; const state = fixture('login-form', () => new Promise(resolve => { finish = resolve; }));
  const first = state.fire(); await state.fire();
  assert.equal(state.calls.length,1); assert.equal(state.inputs[1].value,'');
  finish({mfaRequired:true,challenge}); await first;
  assert.equal(state.location.pathname,'/admin/login');
});

test('client login requires a real user response before opening home', async () => {
  for (const [response,path] of [[{},'/initial'],[{user:{id:'synthetic',role:'customer'}},'/app/home']]) {
    const state=fixture('login-form',async()=>response); await state.fire(); assert.equal(state.location.pathname,path);
    if(path==='/initial'){assert.ok(state.error.textContent);assert.equal(state.button.disabled,false);}
  }
});

test('client registration submits once, clears passwords and saves only a valid challenge', async () => {
  let finish; const state=fixture('register-form',()=>new Promise(resolve=>{finish=resolve;}));
  const first=state.fire(); await state.fire(); assert.equal(state.calls.length,1);
  assert.equal(state.calls[0][1].body.password,'synthetic-password'); assert.equal(state.inputs[2].value,''); assert.equal(state.inputs[3].value,'');
  finish({challenge}); await first; assert.equal(state.location.pathname,'/app/verify');
  assert.equal(state.storage.get('fc.auth.verificationChallenge'),challenge);
  assert.ok(![...state.storage.values()].includes('synthetic-password'));
  const invalid=fixture('register-form',async()=>({challenge:'bad'})); await invalid.fire();
  assert.equal(invalid.location.pathname,'/initial'); assert.equal(invalid.storage.has('fc.auth.verificationChallenge'),false);
});

test('client verification serializes confirmation with resend and requires verified API response', async () => {
  let finish; const state=fixture('verify-form',()=>new Promise(resolve=>{finish=resolve;}),{'fc.auth.mode':'verification','fc.auth.verificationChallenge':challenge});
  state.code(); const confirmation=state.fire(); await state.fire(); await state.fire(state.resend,'click');
  assert.equal(state.calls.length,1); finish({user:{id:'synthetic',emailVerified:true}}); await confirmation;
  assert.equal(state.location.pathname,'/app/login'); assert.equal(state.storage.has('fc.auth.verificationChallenge'),false);
  const invalid=fixture('verify-form',async()=>({}),{'fc.auth.mode':'verification','fc.auth.verificationChallenge':challenge});
  invalid.code(); await invalid.fire(); assert.equal(invalid.location.pathname,'/initial'); assert.equal(invalid.storage.get('fc.auth.verificationChallenge'),challenge);
});

test('client resend blocks confirmation and preserves challenge when throttled', async () => {
  let reject; const state=fixture('verify-form',()=>new Promise((_resolve,rejection)=>{reject=rejection;}),{'fc.auth.mode':'verification','fc.auth.verificationChallenge':challenge,'fc.auth.contact':'active@example.test'});
  state.code(); const resend=state.fire(state.resend,'click'); await state.fire(); await state.fire(state.resend,'click');
  assert.equal(state.calls.length,1); reject(new ApiError('verification_request_limited','Aguarde',429)); await resend;
  assert.equal(state.storage.get('fc.auth.verificationChallenge'),challenge); assert.equal(state.button.disabled,false); assert.equal(state.resend.disabled,false);
});

test('client verification clears exhausted challenges but preserves them for general rate limits', async () => {
  for(const code of ['too_many_attempts','rate_limited']){
    const state=fixture('verify-form',async()=>{throw new ApiError(code,'Aguarde',429);},{'fc.auth.mode':'verification','fc.auth.verificationChallenge':challenge});
    state.code(); await state.fire(); assert.equal(state.storage.has('fc.auth.verificationChallenge'),code==='rate_limited'); assert.equal(state.location.pathname,'/initial');
  }
});

test('client password reset requires confirmed success and keeps recoverable errors editable', async () => {
  for(const code of ['invalid_or_expired_token','too_many_attempts','rate_limited']){
    const state=fixture('reset-password-form',async()=>{throw new ApiError(code,'Não foi possível confirmar',code==='invalid_or_expired_token'?422:429);},{'fc.auth.recoveryChallenge':challenge,'fc.auth.recoveryToken':'123456'});
    await state.fire(); assert.equal(state.location.pathname,'/initial'); assert.equal(state.inputs[0].value,'');
    assert.equal(state.storage.has('fc.auth.recoveryChallenge'),code!=='too_many_attempts');
    assert.equal(state.storage.has('fc.auth.recoveryToken'),code==='rate_limited');
  }
  let finish; const success=fixture('reset-password-form',()=>new Promise(resolve=>{finish=resolve;}),{'fc.auth.recoveryChallenge':challenge,'fc.auth.recoveryToken':'123456'});
  const first=success.fire(); await success.fire(); assert.equal(success.calls.length,1); finish({success:true}); await first;
  assert.equal(success.location.pathname,'/app/login'); assert.equal(success.storage.size,0);
  const invalid=fixture('reset-password-form',async()=>({success:false}),{'fc.auth.recoveryChallenge':challenge,'fc.auth.recoveryToken':'123456'});
  await invalid.fire(); assert.equal(invalid.location.pathname,'/initial'); assert.equal(invalid.notices.length,0);
});

test('client recovery accepts valid challenges and rejects malformed contacts and responses', async () => {
  const good=fixture('recovery-form',async()=>({challenge})); await good.fire(); assert.equal(good.location.pathname,'/app/verify');
  const invalid=fixture('recovery-form',async()=>({challenge:'invalid'})); await invalid.fire(); assert.equal(invalid.location.pathname,'/initial');
  for(const contact of ['bad@12345678','1234567890123456']){
    const state=fixture('recovery-form',async()=>({challenge})); state.inputs[0].value=contact; await state.fire(); assert.equal(state.calls.length,0);
  }
});
