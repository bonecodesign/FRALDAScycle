import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const approved='Ao confirmar, o endereço será compartilhado com os envolvidos na entrega ou retirada. Depois disso, solicitações de cancelamento deverão ser feitas pelo suporte.';
const files={
  generalHtml:new URL('../apps/app/addresses.html',import.meta.url),
  generalJs:new URL('../apps/app/addresses.js',import.meta.url),
  donationHtml:new URL('../apps/app/donations.html',import.meta.url),
  donationJs:new URL('../apps/app/donations.js',import.meta.url),
  changeHtml:new URL('../apps/app/address-changes.html',import.meta.url),
  changeJs:new URL('../apps/app/address-changes.js',import.meta.url),
};

test('every address-sharing interface presents the exact approved notice with explicit confirmation',async()=>{
  const [general,donation,change]=await Promise.all([readFile(files.generalHtml,'utf8'),readFile(files.donationHtml,'utf8'),readFile(files.changeHtml,'utf8')]);
  for(const [surface,html] of Object.entries({general,donation,change})){
    assert.equal(html.includes(approved),true,`${surface} deve exibir o aviso aprovado integralmente`);
    const noticeLabel=html.slice(Math.max(0,html.indexOf(approved)-120),html.indexOf(approved)+approved.length+20);
    assert.match(noticeLabel,/<input(?=[^>]*type="checkbox")(?=[^>]*name="confirmed")(?=[^>]*required)[^>]*>/);
  }
});

test('every address-sharing submission binds the checked value to FC-ADDRESS-1',async()=>{
  const [general,donation,change]=await Promise.all([readFile(files.generalJs,'utf8'),readFile(files.donationJs,'utf8'),readFile(files.changeJs,'utf8')]);
  assert.match(general,/confirmed:share\.elements\.confirmed\.checked,noticeVersion:'FC-ADDRESS-1'/);
  assert.match(donation,/confirmed:forms\.share\.elements\.confirmed\.checked,noticeVersion:'FC-ADDRESS-1'/);
  assert.match(change,/confirmed:form\.elements\.confirmed\.checked,noticeVersion:'FC-ADDRESS-1'/);
  assert.match(general,/choice\.addEventListener\('change',\(\)=>\{share\.elements\.confirmed\.checked=false/);
  assert.match(donation,/forms\[name\]\.reset\(\)/);
  assert.match(change,/form\.reset\(\)/);
  for(const source of [general,donation,change])assert.doesNotMatch(source,/confirmed:true,noticeVersion:'FC-ADDRESS-1'/);
});

test('the API keeps confirmation and notice version inseparable',async()=>{
  const [service,changeService]=await Promise.all([
    readFile(new URL('../apps/api/logistics-service.js',import.meta.url),'utf8'),
    readFile(new URL('../apps/api/address-change-service.js',import.meta.url),'utf8'),
  ]);
  assert.match(service,/input\?\.confirmed!==true\|\|input\?\.noticeVersion!=="FC-ADDRESS-1"/);
  assert.match(changeService,/input\.confirmed!==true\|\|input\.noticeVersion!=='FC-ADDRESS-1'/);
});
