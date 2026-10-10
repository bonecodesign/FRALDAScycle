import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const id='11111111-1111-4111-8111-111111111111';
function element(){return {children:[],handlers:{},disabled:false,append(node){this.children.push(node)},replaceChildren(){this.children=[]},addEventListener(type,fn){this.handlers[type]=fn}};}
async function harness(apiRequest,signal={aborted:false}){
 const source=(await readFile(new URL('../apps/app/courier-details.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'');
 const contact=element(),payout=element(),output=element(),feedback=element(),values=new Map([['fc.activeShipmentId',id],['fc.deliveryProofMediaKey','saved-photo']]);
 const document={hidden:false,handlers:{},getElementById:key=>({'courier-contact':contact,'courier-payout':payout,'courier-details':output,'courier-details-feedback':feedback})[key],createElement:element,addEventListener(type,fn){this.handlers[type]=fn}};
 const window={handlers:{},addEventListener(type,fn){this.handlers[type]=fn}};
 vm.runInNewContext(source,{apiRequest,document,window,sessionStorage:{getItem:key=>values.get(key)??null},AbortSignal:{timeout:()=>signal}});
 return {contact,payout,output,feedback,values,document,window,signal,text:()=>output.children.map(n=>n.textContent).join('\n')};
}
const contact={displayName:'<img src=x onerror=alert(1)>',phone:'+55 (31) 99999-0000',purpose:'pickup'};
const payout={eligible:false,blockers:['receiver_approval_pending'],status:'not_prepared',freightCents:1000,platformFeeCents:null,courierAmountCents:null,payoutAllowed:false};
test('details query is explicit, GET-only and renders authorized contact as text',async()=>{
 const calls=[];const app=await harness(async(path,options)=>{calls.push(path);assert.equal(options.method,undefined);assert.ok(options.signal);return {contact}});
 assert.equal(calls.length,0);await app.contact.handlers.click();assert.deepEqual(calls,['/v1/shipments/'+id+'/contact']);assert.match(app.text(),/Contato para coleta/);assert.match(app.text(),/<img/);assert.equal(app.values.get('fc.deliveryProofMediaKey'),'saved-photo');
});
test('payout is informational, preserves missing amounts and never sends preparation request',async()=>{
 const app=await harness(async(path,options)=>{assert.equal(path,'/v1/shipments/'+id+'/courier-payout');assert.equal(options.method,undefined);return {payout}});
 await app.payout.handlers.click();assert.match(app.text(),/Aprovação do recebedor pendente/);assert.match(app.text(),/Comissão registrada: Não informado/);assert.match(app.text(),/Não confirma pagamento/);assert.equal(app.values.get('fc.activeShipmentId'),id);
});
test('duplicate clicks are blocked and failure clears previously disclosed contact',async()=>{
 let calls=0,finish;const app=await harness(async()=>{calls++;if(calls===1)return {contact};return new Promise((_,reject)=>finish=reject)});
 await app.contact.handlers.click();const pending=app.payout.handlers.click();await app.contact.handlers.click();assert.equal(calls,2);assert.equal(app.output.children.length,0);assert.equal(app.contact.disabled,true);finish(new Error('Acesso revogado'));await pending;assert.equal(app.output.children.length,0);assert.equal(app.contact.disabled,false);assert.equal(app.feedback.textContent,'Acesso revogado');
});
test('old response cannot reveal contact after selection changes or tab hides',async()=>{
 for(const change of ['selection','hidden']){
  let finish;const app=await harness(async()=>new Promise(resolve=>finish=resolve));const pending=app.contact.handlers.click();
  if(change==='selection')app.values.set('fc.activeShipmentId','other');else{app.document.hidden=true;app.document.handlers.visibilitychange();app.document.hidden=false;}
  finish({contact});await pending;assert.equal(app.output.children.length,0);assert.equal(app.contact.disabled,false);
 }
});
test('hidden tab and pagehide remove disclosed private data',async()=>{
 const app=await harness(async()=>({contact}));await app.contact.handlers.click();assert.ok(app.output.children.length);app.document.hidden=true;app.document.handlers.visibilitychange();assert.equal(app.output.children.length,0);app.document.hidden=false;await app.contact.handlers.click();app.window.handlers.pagehide();assert.equal(app.output.children.length,0);
});
test('invalid selection and malformed contact do not disclose data',async()=>{
 let calls=0;const app=await harness(async()=>{calls++;return {contact:{...contact,phone:'javascript:alert(1)'}}});app.values.delete('fc.activeShipmentId');await app.contact.handlers.click();assert.equal(calls,0);app.values.set('fc.activeShipmentId',id);await app.contact.handlers.click();assert.equal(app.output.children.length,0);assert.match(app.feedback.textContent,/confirmar o contato/);
});
test('inconsistent payout and unknown states cannot be displayed as financial confirmation',async()=>{
 for(const data of [{...payout,status:'paid'},{...payout,payoutAllowed:true},{...payout,courierAmountCents:-1},{...payout,eligible:true},{...payout,blockers:['constructor']}]){const app=await harness(async()=>({payout:data}));await app.payout.handlers.click();assert.equal(app.output.children.length,0);assert.match(app.feedback.textContent,/confirmar/);}
});
test('timeout releases controls and keeps saved proof for a retry',async()=>{
 let fail;const app=await harness(async()=>new Promise((_,reject)=>fail=reject));const pending=app.contact.handlers.click();app.signal.aborted=true;fail(new Error('AbortError'));await pending;assert.equal(app.contact.disabled,false);assert.match(app.feedback.textContent,/demorou/);assert.equal(app.values.get('fc.deliveryProofMediaKey'),'saved-photo');
});
