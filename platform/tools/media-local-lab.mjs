/**
 * FC-362. Offline, opt-in local experiment (never invoked during deployment).
 * No npm/pip installations, credentials, provider requests, or image exports.
 * The Python process sends raw synthetic OCR only through the parent/child pipe;
 * this module discards it before generating redacted evidence.
 */
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { detectProhibitedContent, CONTENT_RULE_VERSION } from '../packages/contracts/content-moderation.js';

const sha256 = /^[0-9a-f]{64}$/;
const expectedCases = ['clean-packaged-product','synthetic-contact','synthetic-qr'];

export function evaluateMediaLab(raw) {
  if (raw?.schemaVersion !== 1 || !Array.isArray(raw.cases) || raw.cases.length !== expectedCases.length ||
      !raw.runtime || !raw.negativeInputs || !raw.antivirus) {
    throw new Error('Incomplete local image experiment: not approved');
  }
  const byCase = new Map(raw.cases.map(item => [item.case, item]));
  if (byCase.size !== expectedCases.length || expectedCases.some(key => !byCase.has(key))) {
    throw new Error('Unexpected experiment fixture set');
  }
  for (const fixture of raw.cases) {
    const {metadata: m} = fixture;
    if (!sha256.test(fixture.inputSha256) || !sha256.test(fixture.outputSha256) ||
        fixture.inputSha256 === fixture.outputSha256 ||
        !m || m.inputHadExif !== true || m.inputHadGps !== true ||
        m.outputNoExif !== true || m.outputNoGps !== true ||
        m.type !== 'WEBP' || !Number.isInteger(m.width) || !Number.isInteger(m.height) ||
        m.width < 1 || m.width > 1600 || m.height < 1 || m.height > 1600 ||
        !Number.isInteger(m.bytes) || m.bytes < 1 || m.bytes > 10_000_000 ||
        typeof fixture.ocr !== 'string' || typeof fixture.qrDetected !== 'boolean') {
      throw new Error('Image conversion/metadata experiment invalid: ' + fixture.case);
    }
  }
  const clean = byCase.get('clean-packaged-product');
  const contact = byCase.get('synthetic-contact');
  const qr = byCase.get('synthetic-qr');
  if (detectProhibitedContent(clean.ocr).length || clean.qrDetected ||
      !detectProhibitedContent(contact.ocr).includes('phone') || contact.qrDetected ||
      !qr.qrDetected || raw.negativeInputs.corruptedRejected !== true ||
      raw.negativeInputs.oversizedRejected !== true) {
    throw new Error('An expected synthetic safety decision failed; NO-GO');
  }
  // Never infer malware scanning even when clamscan is installed: this
  // experiment does not scan and cannot grant operational approval.
  return {
    schemaVersion: 1,
    id: 'FC-362',
    environment: 'isolated-assistant-local-container-not-user-device',
    evidenceType: 'local-synthetic-tool-experiment',
    newSpendingBrl: 0,
    status: 'partial-not-homologated',
    contentRuleVersion: CONTENT_RULE_VERSION,
    toolsObserved: {
      pillow: raw.runtime.pillow, opencv: raw.runtime.opencv, tesseract: raw.runtime.tesseract,
      sharpExecuted: false, zxingExecuted: false,
    },
    checks: {
      syntheticJpegToWebp: 'passed',
      syntheticExifRemoval: 'passed',
      syntheticGpsRemoval: 'passed',
      syntheticPhoneOcrAndCurrentModerationRule: 'passed',
      syntheticQrDetection: 'passed',
      harmlessProductNotFlagged: 'passed',
      corruptImageRejected: 'passed',
      excessiveDimensionRejected: 'passed',
      antivirusScan: 'blocked-not-executed',
      realProvider: 'not-tested',
      observedHumanReview: 'not-tested',
    },
    inputCount: expectedCases.length,
    artificialFixtureHashes: raw.cases.map(item => ({
      case: item.case,
      inputSha256: item.inputSha256,
      processedSha256: item.outputSha256,
      processedBytes: item.metadata.bytes,
    })),
    rawOcrTextPersisted: false,
    qrPayloadPersisted: false,
    realImageProcessed: false,
    providerUsed: false,
    cloudServiceActivated: false,
    operationalReleaseAllowed: false,
    officialCriteriaPromoted: false,
    note: 'Antivirus, real storage immutability, actual provider security and human image review remain unproven. No hosted tests or source images are included.',
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const python = process.env.PYTHON || 'python3';
  const pythonScript = fileURLToPath(new URL('./media-local-lab.py', import.meta.url));
  try {
    const stdout = execFileSync(python, [pythonScript], {
      encoding: 'utf8', timeout: 90_000, maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const safeReport = evaluateMediaLab(JSON.parse(stdout));
    const reportPath = process.argv[2];
    if (reportPath) {
      await writeFile(reportPath, JSON.stringify(safeReport, null, 2) + '\n', {flag: 'wx'});
    }
    console.log(JSON.stringify({id:safeReport.id,status:safeReport.status,checks:safeReport.checks},null,2));
  } catch (error) {
    console.error('FC-362 local lab blocked or failed:',error.message.slice(0,220));
    process.exitCode = 1;
  }
}
