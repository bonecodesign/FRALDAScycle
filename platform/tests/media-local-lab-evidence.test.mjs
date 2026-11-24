import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateMediaLab } from '../tools/media-local-lab.mjs';

const hex = n => n.toString(16).repeat(64);
function synthetic() {
  const item = (name, index, ocr, qrDetected) => ({
    case:name,inputSha256:hex(index),outputSha256:hex(index + 3),
    metadata:{inputHadExif:true,inputHadGps:true,outputNoExif:true,outputNoGps:true,
      type:'WEBP',width:800,height:640,bytes:4048},
    ocr,qrDetected,
  });
  return {
    schemaVersion:1,
    runtime:{pillow:'synthetic-version',opencv:'synthetic-version',tesseract:'synthetic-version'},
    cases:[item('clean-packaged-product',1,'Pacote lacrado com 50 unidades',false),
      item('synthetic-contact',2,'Contato: (31) 99999-0000',false),
      item('synthetic-qr',3,'',true)],
    negativeInputs:{corruptedRejected:true,oversizedRejected:true},
    antivirus:{clamscanAvailable:false,scanPerformed:false},
  };
}

test('FC-362: synthetic passing evidence never claims AV, supplier, release or raw OCR retention',()=>{
  const r=evaluateMediaLab(synthetic());
  assert.equal(r.status,'partial-not-homologated');
  assert.equal(r.checks.antivirusScan,'blocked-not-executed');
  assert.equal(r.operationalReleaseAllowed,false);
  assert.equal(r.providerUsed,false);
  assert.equal(r.rawOcrTextPersisted,false);
  assert.doesNotMatch(JSON.stringify(r),/99999-0000|Contato:/);
  assert.equal(r.artificialFixtureHashes.length,3);
});

test('FC-362: expected OCR, QR, metadata and negative outcomes must not be forged as success',()=>{
  const cases=[
    x=>{x.cases[1].ocr='';},
    x=>{x.cases[2].qrDetected=false;},
    x=>{x.cases[0].metadata.outputNoExif=false;},
    x=>{x.cases[0].metadata.inputHadExif=false;},
    x=>{x.cases[0].metadata.inputHadGps=false;},
    x=>{x.negativeInputs.corruptedRejected=false;},
    x=>{x.negativeInputs.oversizedRejected=false;},
    x=>{x.cases[1].inputSha256=x.cases[1].outputSha256;},
    x=>{x.cases.pop();},
  ];
  for(const mutate of cases){const raw=synthetic();mutate(raw);assert.throws(()=>evaluateMediaLab(raw));}
});
