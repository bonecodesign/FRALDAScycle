import assert from 'node:assert/strict';

// Browser automation only: this is NOT a human accessibility audit, physical
// device certification, live media-provider test or authorization to launch.
export async function checkPublicationBrowser({call,evaluate,until,key,surfaceOrigin,syntheticMediaKey=null}){
  const widths=[320,375,768,1280],layouts=[],keyboardPaths=[];
  const navigate=async(path,selector)=>{
    await call('Page.navigate',{url:surfaceOrigin+path});
    await until(()=>evaluate(`document.readyState==='complete' && location.pathname===${JSON.stringify(path)} && Boolean(document.querySelector(${JSON.stringify(selector)}))`),'load '+path);
  };
  const stepReady=async(step)=>until(()=>evaluate(`document.querySelector('[data-publish-step="${step}"]')!==null && document.querySelector('.screen-title-row .badge')?.textContent==='Rascunho nesta aba'`),'publication step '+step+' JS ready');
  const press=async(selector)=>{
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await key('Enter','Enter',13);
  };
  await navigate('/app/publish-1','[data-publish-step="1"]');
  await until(()=>evaluate(`document.querySelector('.screen-title-row .badge')?.textContent==='Rascunho nesta aba'`),'publication module ready');
  await evaluate(`document.querySelector('input[name="kind"][value="exchange"]').focus()`);
  await key(' ','Space',32);
  assert.equal(await evaluate(`JSON.parse(sessionStorage.getItem('fc.publishDraft')).kind`),'exchange');
  await evaluate(`document.querySelector('input[name="kind"][value="sale"]').focus()`);
  await key(' ','Space',32);
  assert.equal(await evaluate(`JSON.parse(sessionStorage.getItem('fc.publishDraft')).kind`),'sale');
  await press('#publish-next');
  await until(()=>evaluate(`location.pathname==='/app/publish-2'`),'publication step 2 keyboard transition');
  await stepReady(2);
  await until(()=>evaluate(`Boolean(document.querySelector('#app-stock-units')) && Boolean(document.querySelector('#app-diaper-model')?.value)`),'catalog options initialized');
  await evaluate(`document.querySelector('#app-diaper-quantity').value='';document.querySelector('#app-diaper-quantity').focus()`);
  await call('Input.insertText',{text:'32'});
  assert.equal(await evaluate(`JSON.parse(sessionStorage.getItem('fc.publishDraft')).quantity`),'32');
  await press('#publish-next');
  await until(()=>evaluate(`location.pathname==='/app/publish-3'`),'publication step 3 keyboard transition');
  await stepReady(3);
  await until(()=>evaluate(`Boolean(document.querySelector('.upload-zone'))`),'publication upload control');
  assert.equal(await evaluate(`document.getElementById('publish-next').disabled`),true,'no photo means no advance');
  // The integrated PostgreSQL/browser rehearsal injects only a pre-processed
  // synthetic media reference. It never weakens the UI rule that a real run
  // must upload and validate a photo before publication.
  if(syntheticMediaKey){
    await evaluate(`sessionStorage.setItem('fc.publishMediaKey',${JSON.stringify(syntheticMediaKey)})`);
    await navigate('/app/publish-3','[data-publish-step="3"]');
    await stepReady(3);
    await until(()=>evaluate(`document.getElementById('publish-next').disabled===false`),'synthetic media reference restores publication readiness');
  }
  await navigate('/app/publish-4','[data-publish-step="4"]');
  await stepReady(4);
  await evaluate(`document.querySelector('#publish-expiry').focus()`);
  await call('Input.insertText',{text:'08/2027'});
  await evaluate(`document.querySelector('#publish-description').focus()`);
  await call('Input.insertText',{text:'Pacote lacrado guardado em ambiente seco e limpo.'});
  await press('#publish-next');
  await until(()=>evaluate(`location.pathname==='/app/publish-5'`),'publication step 5 keyboard transition');
  await stepReady(5);
  await press('#publish-next');
  assert.match(await evaluate(`document.querySelector('.publish-error')?.textContent`),/Informe o valor/);
  assert.equal(await evaluate('location.pathname'),'/app/publish-5');
  assert.equal(await evaluate("document.activeElement === document.querySelector('.publish-error')"),true,'validation must move focus to the error');
  await evaluate(`document.getElementById('publish-price').focus()`);
  await call('Input.insertText',{text:'37,90'});
  assert.equal(await evaluate(`JSON.parse(sessionStorage.getItem('fc.publishDraft')).priceCents`),3790,'typed price is not replaced by a demo amount');
  await press('#publish-next');
  await until(()=>evaluate(`location.pathname==='/app/publish-6'`),'publication step 6 keyboard transition');
  await stepReady(6);
  assert.equal(await evaluate(`JSON.parse(sessionStorage.getItem('fc.publishDraft')).delivery`),'Entrega por parceiro');
  await press('#publish-next');
  await until(()=>evaluate(`location.pathname==='/app/publish-7'`),'publication step 7 keyboard transition');
  await stepReady(7);
  await press('#publish-next');
  assert.equal(await evaluate('location.pathname'),'/app/publish-7','location must not be skipped');
  assert.match(await evaluate(`document.querySelector('.publish-error').textContent`),/cidade e UF|CEP válido/);
  assert.equal(await evaluate("document.activeElement === document.querySelector('.publish-error')"),true,'location validation must move focus to the error');
  for(let step=1;step<=8;step++){
    await navigate('/app/publish-'+step,'[data-publish-step="'+step+'"]');
    await until(()=>evaluate(`document.querySelector('.screen-title-row .badge')?.textContent==='Rascunho nesta aba'`),'publication route initialized');
    for(const width of widths){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      const layout=await evaluate(`(() => {
        const area=document.querySelector('#publish-content');
        const editable=[...area.querySelectorAll('input,select,textarea')].filter(el=>el.getClientRects().length && el.type!=='hidden');
        const controls=[...area.querySelectorAll('button,input,select,textarea')].filter(el=>el.getClientRects().length && el.type!=='hidden');
        return {
          overflow:document.documentElement.scrollWidth>innerWidth+1,
          missingLabels:editable.filter(el=>!el.labels?.length && !el.getAttribute('aria-label')).map(el=>el.outerHTML.slice(0,110)),
          clipped:controls.filter(el=>{const r=el.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1}).map(el=>el.id||el.tagName),
          skipLink:document.querySelector('.skip-link')?.getAttribute('href')==='#main',
          main:document.querySelector('main')?.id==='main',
          errorAlert:document.querySelector('.publish-error')?.getAttribute('role')==='alert'
        };
      })()`);
      assert.equal(layout.overflow,false,`Horizontal publication overflow at ${step}/${width}`);
      assert.deepEqual(layout.missingLabels,[],`Unlabelled fields at ${step}/${width}`);
      assert.deepEqual(layout.clipped,[],`Clipped controls at ${step}/${width}`);
      assert.equal(layout.skipLink,true);
      assert.equal(layout.main,true);
      assert.equal(layout.errorAlert,true);
      layouts.push({step,viewport:width,overflow:false,labels:true});
    }
  }
  // Unlike the earlier targeted focus checks, this traversal uses actual Tab
  // events from a freshly loaded document, not DOM focus() calls.
  for(const width of [375,1280]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
    for(let step=1;step<=8;step++){
      await navigate('/app/publish-'+step,'[data-publish-step="'+step+'"]');
      await stepReady(step);
      await key('Tab','Tab',9);
      assert.equal(await evaluate("document.activeElement === document.querySelector('.skip-link')"),true,`Skip link first at ${step}/${width}`);
      await key('Enter','Enter',13);
      assert.equal(await evaluate("document.activeElement === document.getElementById('main')"),true,`Skip link reaches main at ${step}/${width}`);
      const expected=await evaluate(`(() => {
        const area=document.querySelector('#publish-content');
        const controls=[...area.querySelectorAll('a[href],button,input,select,textarea')];
        return controls.map((el,i)=>({el,i})).filter(({el})=>
          !el.disabled && el.type!=='hidden' && el.tabIndex>=0 && el.getClientRects().length &&
          getComputedStyle(el).visibility!=='hidden' &&
          (el.type!=='radio'||el.checked||!controls.some(other=>other.type==='radio'&&other.name===el.name&&other.checked))
        ).map(({i})=>i);
      })()`);
      assert.ok(expected.length>0,`No keyboard controls at ${step}/${width}`);
      const visited=[];
      for(let n=0;n<60;n++){
        await key('Tab','Tab',9);
        const current=await evaluate(`(() => {
          const active=document.activeElement;
          if(active===document.body||active===document.querySelector('.skip-link'))return 'end';
          return [...document.querySelectorAll('#publish-content a[href],#publish-content button,#publish-content input,#publish-content select,#publish-content textarea')].indexOf(active);
        })()`);
        if(current==='end')break;
        if(current>=0)visited.push(current);
        else if(visited.length>0)break;
      }
      assert.deepEqual(visited,expected,`Tab order at step ${step}/${width}`);
      keyboardPaths.push({step,viewport:width,controls:visited.length});
    }
  }
  await navigate('/app/publish-8','[data-publish-step="8"]');
  await stepReady(8);
  await until(()=>evaluate(`document.querySelector('.review-product')!==null`),'review renders');
  assert.equal(await evaluate(`document.querySelector('.review-product .price')?.textContent.includes('37,90')`),true);
  let successfulPublication=false,listingId=null;
  await press('#publish-submit');
  if(syntheticMediaKey){
    await until(()=>evaluate(`document.querySelector('.success-state h1')?.textContent.includes('Anúncio enviado para revisão')`),'synthetic publication receipt');
    listingId=await evaluate(`sessionStorage.getItem('fc.lastListingId')`);
    assert.match(listingId,/^[0-9a-f-]{36}$/i);
    successfulPublication=true;
  }else{
    await until(()=>evaluate(`Boolean(document.querySelector('#publication-issues'))`),'missing-media validation');
    assert.match(await evaluate(`document.querySelector('#publication-issues').textContent`),/foto/i);
    assert.equal(await evaluate("document.activeElement === document.getElementById('publication-issues')"),true,'review errors receive focus');
    await key('Tab','Tab',9);
    assert.equal(await evaluate("document.activeElement === document.querySelector('#publication-issues a')"),true,'Tab reaches the first actionable correction');
    assert.equal(await evaluate(`sessionStorage.getItem('fc.lastListingId')`),null);
  }
  assert.equal(await evaluate(`JSON.parse(sessionStorage.getItem('fc.publishDraft')).priceCents`),3790);
  await navigate('/app/search','#app-search-submit');
  await until(()=>evaluate(`Boolean(document.getElementById('app-search-input'))`),'search ready');
  await evaluate(`document.querySelector('#app-search-input').focus()`);
  await call('Input.insertText',{text:'fraldacycle-browser-no-match-9948'});
  await key('Enter','Enter',13);
  await until(()=>evaluate(`document.querySelector('#app-search-submit')?.textContent==='Buscar novamente' && !document.querySelector('#app-search-submit').disabled`),'search server response');
  assert.equal(await evaluate(`Boolean(document.querySelector('#app-search-results .error-state'))`),false,'search API must not report an error');
  assert.equal(await evaluate(`document.querySelector('#app-search-results')?.textContent.includes('Nenhum item encontrado')`),true);
  await evaluate(`document.querySelector('#app-filter-reset').focus()`);
  await key('Enter','Enter',13);
  assert.equal(await evaluate(`document.querySelector('#app-search-results')?.textContent.includes('Faça uma busca')`),true);
  await evaluate(`sessionStorage.removeItem('fc.activeTransactionId')`);
  await navigate('/app/chat','#chat-payment-gate');
  await until(()=>evaluate(`document.querySelector('#chat-payment-gate')?.textContent.includes('Chat bloqueado')`),'chat denies unpaid access');
  assert.equal(await evaluate(`document.querySelector('#msg').disabled && document.querySelector('#chat-form button[type="submit"]').disabled`),true);
  assert.equal(await evaluate(`document.getElementById('transaction-contact').disabled`),true);
  await evaluate(`sessionStorage.removeItem('fc.publishDraft');sessionStorage.removeItem('fc.publishAttempt');sessionStorage.removeItem('fc.publishMediaKey')`);
  return {browserAutomation:true,viewportChecks:layouts.length,layouts,keyboardPaths,keyboardPathsChecked:keyboardPaths.length,priceCents:3790,mediaRequired:true,syntheticMedia:Boolean(syntheticMediaKey),listingId,searchNegativeQuery:true,chatUnpaidBlocked:true,humanValidation:false,screenReader:false,physicalDevices:false,successfulPublication};
}
