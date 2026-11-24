/** FC-365: offline *synthetic* full image chain; never a media service.
 * Invoke real FC-363 ClamAV self-test first, then scan original + WebP bytes,
 * OCR and QR, and apply the existing FraldaCycle text policy.
 * No uploads, accounts, permanent files, or reusable "scanStatus: clean".
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { executeClamavLocalLab } from './media-local-antivirus-lab.mjs';
import { detectProhibitedContent, CONTENT_RULE_VERSION } from '../packages/contracts/content-moderation.js';

const EXPECTED = ['synthetic-clean','synthetic-phone','synthetic-qr','synthetic-eicar','synthetic-corrupted'];
const ORDER = ['input-av','image-decoder','webp-no-exif','output-av','ocr','qr','content-policy'];
const SHA = /^[a-f0-9]{64}$/;


/** Validate one *synthetic* case. Never accept a provider attestation here. */
export function evaluateSyntheticImageCase(c, name) {
  if (!EXPECTED.includes(name) || c?.case !== name || !SHA.test(c.inputSha256) ||
      !['clean','eicar-detected','scan-error'].includes(c.inputAntivirus)) {
    throw new Error('Unverified synthetic image or source scan');
  }
  if (name === 'synthetic-eicar') {
    if (c.inputAntivirus !== 'eicar-detected' || c.decoded !== false || c.converted !== false ||
        c.outputAntivirus !== 'not-attempted' || c.ocr !== null || c.qrDetected !== null ||
        c.outputSha256 !== null || c.metadata !== null) {
      throw new Error('Synthetic EICAR must be blocked at first AV boundary');
    }
    return Object.freeze({case:name,decision:'blocked-threat-before-decoding'});
  }
  if (c.inputAntivirus !== 'clean') throw new Error('Synthetic image input AV incomplete');
  if (name === 'synthetic-corrupted') {
    if (c.decoded !== false || c.converted !== false || c.outputAntivirus !== 'not-attempted' ||
        c.ocr !== null || c.qrDetected !== null || c.metadata !== null || c.outputSha256 !== null) {
      throw new Error('Invalid synthetic image must fail before conversion');
    }
    return Object.freeze({case:name,decision:'blocked-image-decoder'});
  }
  const m=c.metadata;
  if (c.decoded !== true || c.converted !== true || c.outputAntivirus !== 'clean' ||
      !SHA.test(c.outputSha256) || c.inputSha256 === c.outputSha256 ||
      !m || m.inputHadExif !== true || m.inputHadGps !== true ||
      m.outputNoExif !== true || m.outputNoGps !== true || m.type !== 'WEBP' ||
      !Number.isInteger(m.width) || m.width < 1 || m.width > 1600 ||
      !Number.isInteger(m.height) || m.height < 1 || m.height > 1600 ||
      !Number.isInteger(m.bytes) || m.bytes < 1 || m.bytes > 10_000_000 ||
      typeof c.ocr !== 'string' || typeof c.qrDetected !== 'boolean') {
    throw new Error('Synthetic WebP, EXIF, output AV or OCR/QR evidence incomplete');
  }
  const contactReasons = detectProhibitedContent(c.ocr);
  if (name === 'synthetic-clean' && (contactReasons.length || c.qrDetected)) {
    throw new Error('Synthetic benign listing unexpectedly blocked');
  }
  if (name === 'synthetic-phone' && (!contactReasons.includes('phone') || c.qrDetected)) {
    throw new Error('OCR missed synthetic external contact');
  }
  if (name === 'synthetic-qr' && !c.qrDetected) {
    throw new Error('QR reader missed synthetic QR');
  }
  return Object.freeze({
    case:name,decision:name === 'synthetic-clean' ? 'local-only-pass-requires-human-review' :
      name === 'synthetic-phone' ? 'blocked-external-contact' : 'blocked-qr-code',
  });
}

export function evaluateSyntheticImageChain(raw, avSelfTest) {
  if (avSelfTest?.status !== 'local-eicar-self-test-passed-not-homologated' ||
      avSelfTest?.actualAvScannerExecuted !== true ||
      !avSelfTest.checks || Object.values(avSelfTest.checks).length !== 5 ||
      Object.values(avSelfTest.checks).some(check => check !== 'passed')) {
    throw new Error('Real antivirus self-test missing or inconclusive');
  }
  if (raw?.schemaVersion !== 1 || !Array.isArray(raw.pipelineOrder) ||
      JSON.stringify(raw.pipelineOrder) !== JSON.stringify(ORDER) ||
      !Array.isArray(raw.cases) || raw.cases.length !== EXPECTED.length) {
    throw new Error('Local chain incomplete or wrong processing order');
  }
  const byName = new Map(raw.cases.map(x => [x?.case, x]));
  if (byName.size !== EXPECTED.length || EXPECTED.some(x => !byName.has(x))) {
    throw new Error('Unexpected or duplicate image chain cases');
  }
  const audit = EXPECTED.map(name => evaluateSyntheticImageCase(byName.get(name), name));
  return Object.freeze({
    id:'FC-365',
    testType:'real-scanner-and-image-libraries-on-artificial-files-only',
    status:'synthetic-chain-test-passed-not-homologated',
    newSpendingBrl:0,
    contentRuleVersion:CONTENT_RULE_VERSION,
    orderVerified:ORDER,
    originalAndProcessedAvScanned:true,
    realAntivirusSelfTestPassed:true,
    audit:Object.freeze(audit),
    rawOcrTextPersisted:false,
    qrPayloadPersisted:false,
    picturesPersisted:false,
    providerUsed:false,
    providerScanStatus:null,
    operationalReleaseAllowed:false,
    officialMediaGatesPromoted:false,
    note:'This is a disposable synthetic experiment, NOT proof of hosted processing, ongoing AV security, or human approval.',
  });
}

const main = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (main) {
  try {
    const av = executeClamavLocalLab();
    if (av.status !== 'local-eicar-self-test-passed-not-homologated') {
      throw new Error('ClamAV prerequisites are unavailable');
    }
    const python = process.env.PYTHON || 'python3';
    const script = fileURLToPath(new URL('./media-local-chain.py', import.meta.url));
    const stdout = execFileSync(python, [script], {
      encoding:'utf8', timeout:120_000, maxBuffer:1024*1024,
      stdio:['ignore','pipe','pipe'],
    });
    const report = evaluateSyntheticImageChain(JSON.parse(stdout), av);
    // stdout from Python may contain a synthetic phone; never print it.
    console.log(JSON.stringify(report,null,2));
  } catch {
    // Fail closed without leaking subprocess paths or unredacted OCR.
    console.error('FC-365 BLOCKED: artificial AV -> WebP -> OCR -> QR chain was not confirmed');
    process.exitCode=2;
  }
}
