import assert from 'node:assert/strict';
export async function checkAuthBrowser({call,evaluate,until,surfaceOrigin,apiOrigin,adminOrigin,fixture,requestAuthCode}) {
  const layouts=[];
  const enter=async()=>{for(const type of ['keyDown','keyUp'])await call('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r'}:{})});};
  const navigate=async(path,form,origin=surfaceOrigin)=>{
    await call('Page.navigate',{url:origin+path});
    await until(()=>evaluate(`document.readyState==='complete'&&Boolean(document.querySelector(${JSON.stringify(form)}))`),path);
    for(const width of [320,375,768,1280]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      const result=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth+1,missingLabels:[...document.querySelectorAll(${JSON.stringify(form+' input')})].filter(i=>i.getBoundingClientRect().width>0&&!i.labels?.length&&!i.getAttribute('aria-label')).length})`);
      assert.equal(result.overflow,false,`${path} overflow ${width}`);assert.equal(result.missingLabels,0,path);layouts.push({path,width,...result});
    }
  };
  const submit=async(form,values)=>{
    await evaluate(`(()=>{const f=document.querySelector(${JSON.stringify(form)});const inputs=[...f.querySelectorAll('input:not([type=checkbox])')];${JSON.stringify(values)}.forEach((v,i)=>inputs[i].value=v);f.querySelectorAll('input[type=checkbox]').forEach(i=>i.checked=true);f.querySelector('button[type=submit]').focus();})()`);await enter();
  };
  const path=expected=>until(()=>evaluate(`location.pathname===${JSON.stringify(expected)}&&document.readyState==='complete'`),expected);
  const error=form=>until(()=>evaluate(`Boolean(document.querySelector(${JSON.stringify(form+' .field-error')})?.textContent)&&!document.querySelector(${JSON.stringify(form+' button[type=submit]')}).disabled`),'invalid credential rejected');
  const status=()=>evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/auth/session')},{credentials:'include'}).then(r=>r.status)`);
  const logout=()=>evaluate(`fetch(${JSON.stringify(apiOrigin+'/v1/auth/logout')},{method:'POST',credentials:'include'}).then(r=>r.status)`);
  const wrong=code=>code==='000000'?'111111':'000000';
  const verify=code=>submit('#verify-form',code.split(''));
  await navigate('/app/register','#register-form');
  await until(()=>evaluate(`Boolean(document.querySelector('[data-adult-declaration]'))`),'adult declaration');
  await submit('#register-form',[fixture.displayName,fixture.email,fixture.password,fixture.password]);await path('/app/verify');
  await navigate('/app/verify','#verify-form');
  const verification=await requestAuthCode(fixture.email,'email_verification');
  await verify(wrong(verification));await error('#verify-form');assert.equal(await status(),401);
  await verify(verification);await path('/app/login');
  assert.equal(await evaluate(`sessionStorage.getItem('fc.auth.verificationChallenge')`),null);
  await submit('#login-form',[fixture.email,fixture.password]);await path('/app/home');assert.equal(await status(),200);
  await navigate('/app/recovery','#recovery-form');await submit('#recovery-form',[fixture.email]);await path('/app/verify');
  const recovery=await requestAuthCode(fixture.email,'password_recovery');
  await verify(wrong(recovery));await path('/app/reset-password');
  await navigate('/app/reset-password','#reset-password-form');
  await submit('#reset-password-form',[fixture.nextPassword,fixture.nextPassword]);await error('#reset-password-form');
  await navigate('/app/verify','#verify-form');await verify(recovery);await path('/app/reset-password');
  await submit('#reset-password-form',[fixture.nextPassword,fixture.nextPassword]);await path('/app/login');
  assert.equal(await status(),401,'Password reset must revoke previous session');
  assert.equal(await evaluate(`sessionStorage.getItem('fc.auth.recoveryChallenge')`),null);
  await submit('#login-form',[fixture.email,fixture.password]);await error('#login-form');assert.equal(await status(),401);
  await submit('#login-form',[fixture.email,fixture.nextPassword]);await path('/app/home');assert.equal(await status(),200);await logout();
  await navigate('/admin/login','#admin-login-form',adminOrigin);await submit('#admin-login-form',[fixture.adminEmail,fixture.adminPassword]);
  await until(()=>evaluate(`!document.getElementById('admin-mfa-form').hidden`),'MFA challenge');assert.equal(await status(),401);
  const mfa=await requestAuthCode(fixture.adminEmail,'admin_login_mfa');
  await submit('#admin-mfa-form',[wrong(mfa)]);await error('#admin-mfa-form');assert.equal(await status(),401);
  await submit('#admin-mfa-form',[mfa]);await path('/admin/dashboard');assert.equal(await status(),200);
  const cookies=await call('Network.getCookies',{urls:[apiOrigin]});assert.ok(cookies.cookies.some(c=>c.name==='fc_session'&&c.httpOnly));await logout();
  return {registration:'verified through actual UI and local outbox',recovery:'invalid code rejected; password changed; previous session revoked; old password rejected',adminMfa:'no session before valid second factor; invalid code rejected; HttpOnly session after confirmation',layouts,externalDelivery:false};
}
