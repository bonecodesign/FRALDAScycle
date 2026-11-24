import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateSyntheticImageChain } from '../tools/media-local-chain.mjs';

const sha = c => c.repeat(64);
function fixture() {
  const av = {
    status:'local-eicar-self-test-passed-not-homologated',
    actualAvScannerExecuted:true,
    checks: {
      engineAndSigtool:'passed',dailySignatureFileRecent:'passed',
      signatureMetadataInspected:'passed',benignSyntheticImage:'passed',
      eicarHarmlessTestDetected:'passed',
    },
  };
  const ready=(name,a,b,ocr,qrDetected)=>({
    case:name,inputSha256:sha(a),inputAntivirus:'clean',
    decoded:true,converted:true,outputAntivirus:'clean',
    outputSha256:sha(b),ocr,qrDetected,
    metadata:{inputHadExif:true,inputHadGps:true,outputNoExif:true,outputNoGps:true,
      type:'WEBP',width:640,height:400,bytes:10000},
  });
  const raw={
    schemaVersion:1,
    pipelineOrder:['input-av','image-decoder','webp-no-exif','output-av','ocr','qr','content-policy'],
    cases:[
      ready('synthetic-clean','1','2','Pacote lacrado com 50 unidades',false),
      ready('synthetic-phone','3','4','Contato: (31) 99999-0000',false),
      ready('synthetic-qr','5','6','',true),
      {case:'synthetic-eicar',inputSha256:sha('7'),inputAntivirus:'eicar-detected',
        decoded:false,converted:false,outputAntivirus:'not-attempted',
        outputSha256:null,ocr:null,qrDetected:null,metadata:null},
      {case:'synthetic-corrupted',inputSha256:sha('8'),inputAntivirus:'clean',
        decoded:false,converted:false,outputAntivirus:'not-attempted',
        outputSha256:null,ocr:null,qrDetected:null,metadata:null},
    ],
  };
  return {raw,av};
}
test('FC-365: synthetic complete chain reports only decisions, not OCR or production pass',()=>{
  const {raw,av}=fixture();
  const report=evaluateSyntheticImageChain(raw,av);
  assert.equal(report.status,'synthetic-chain-test-passed-not-homologated');
  assert.equal(report.audit.length,5);
  assert.deepEqual(report.audit.map(x=>x.decision),[
    'local-only-pass-requires-human-review','blocked-external-contact',
    'blocked-qr-code','blocked-threat-before-decoding','blocked-image-decoder',
  ]);
  assert.equal(report.operationalReleaseAllowed,false);
  assert.equal(report.officialMediaGatesPromoted,false);
  assert.equal(report.providerScanStatus,null);
  assert.equal(report.rawOcrTextPersisted,false);
  assert.doesNotMatch(JSON.stringify(report),/99999-0000|Contato:/);
});

test('FC-365: missing or fabricated AV readiness blocks even a nominally clean fixture',()=>{
  for(const change of [
    x=>{x.av.status='blocked-no-antivirus-clearance';},
    x=>{x.av.actualAvScannerExecuted=false;},
    x=>{x.av.checks.dailySignatureFileRecent='blocked';},
    x=>{delete x.av.checks.eicarHarmlessTestDetected;},
  ]){
    const obj=fixture();change(obj);
    assert.throws(()=>evaluateSyntheticImageChain(obj.raw,obj.av));
  }
});

test('FC-365: scanner failure, missed EICAR, premature conversion or unscanned output blocks',()=>{
  for(const change of [
    x=>{x.raw.cases[0].inputAntivirus='scan-error';},
    x=>{x.raw.cases[0].outputAntivirus='not-attempted';},
    x=>{x.raw.cases[1].outputAntivirus='scan-error';},
    x=>{x.raw.cases[3].inputAntivirus='clean';},
    x=>{x.raw.cases[3].converted=true;},
    x=>{x.raw.cases[4].decoded=true;},
    x=>{x.raw.cases[0].metadata.outputNoExif=false;},
    x=>{x.raw.cases[0].metadata.outputNoGps=false;},
    x=>{x.raw.cases[2].metadata.bytes=10_000_001;},
  ]){
    const obj=fixture();change(obj);
    assert.throws(()=>evaluateSyntheticImageChain(obj.raw,obj.av));
  }
});

test('FC-365: OCR/QR misses, duplicate cases or reordered stages are rejected',()=>{
  for(const change of [
    x=>{x.raw.cases[1].ocr='';},
    x=>{x.raw.cases[2].qrDetected=false;},
    x=>{x.raw.cases[0].ocr='Telefone (31) 99999-0000';},
    x=>{x.raw.cases[1].case='synthetic-clean';},
    x=>{x.raw.pipelineOrder.reverse();},
    x=>{x.raw.cases[2].qrDetected=null;},
  ]){
    const obj=fixture();change(obj);
    assert.throws(()=>evaluateSyntheticImageChain(obj.raw,obj.av));
  }
});
