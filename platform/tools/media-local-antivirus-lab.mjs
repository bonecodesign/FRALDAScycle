/** FC-363: offline, optional ClamAV self-test for the local FraldaCycle lab.
 * No package install, network, freshclam, external files, or provider calls.
 * It never produces a production approval or a reusable scanStatus=clean.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const signatureMaxAgeHours = 72;
const benignPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64');
// Standard, non-malicious EICAR test string, generated only inside a temporary directory.
const eicar = ['X5O!P%@AP[4', '\\PZX54(P^)7CC)7}', '$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'].join('');

function outputIs(result, exitCode, suffix) {
  if (!result || result.error || result.signal || result.status !== exitCode ||
      typeof result.stdout !== 'string' || typeof result.stderr !== 'string' || result.stderr.trim()) return false;
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  // --no-summary: exactly one object and one result. Never accept extra output or errors.
  return lines.length === 1 && lines[0].endsWith(suffix) &&
    !/\b(?:ERROR|WARNING|UNOFFICIAL)\b/i.test(lines[0]);
}

export function assessClamavLocalLab(probe) {
  const available = probe?.engineAvailable === true && probe?.sigtoolAvailable === true;
  const fresh = Number.isFinite(probe?.dailySignatureAgeHours) &&
    probe.dailySignatureAgeHours >= 0 && probe.dailySignatureAgeHours <= signatureMaxAgeHours;
  const signatureChecked = probe?.signatureMetadataValidated === true;
  const benignClean = outputIs(probe?.benign, 0, ': OK');
  const eicarDetected = outputIs(probe?.eicar, 1, ': Eicar-Test-Signature FOUND');
  const passed = available && fresh && signatureChecked && benignClean && eicarDetected &&
    probe?.actualAvScannerExecuted === true;
  return Object.freeze({
    id: 'FC-363',
    status: passed ? 'local-eicar-self-test-passed-not-homologated' : 'blocked-no-antivirus-clearance',
    environment: 'isolated-local-test-only',
    newSpendingBrl: 0,
    checks: Object.freeze({
      engineAndSigtool: available ? 'passed' : 'blocked',
      dailySignatureFileRecent: fresh ? 'passed' : 'blocked',
      signatureMetadataInspected: signatureChecked ? 'passed' : 'blocked',
      benignSyntheticImage: benignClean ? 'passed' : 'blocked',
      eicarHarmlessTestDetected: eicarDetected ? 'passed' : 'blocked',
    }),
    actualAvScannerExecuted: probe?.actualAvScannerExecuted === true,
    providerUsed: false,
    realCustomerMediaUsed: false,
    rawScanOutputPersisted: false,
    reusableProviderScanStatus: null,
    officialMediaGatesPromoted: false,
    operationalReleaseAllowed: false,
    note: 'Self-test alone never certifies malware detection on real user media, signature freshness in production or provider compliance.',
  });
}

function run(program, args, timeout = 30000) {
  return spawnSync(program, args, {
    encoding: 'utf8', timeout, maxBuffer: 128 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, LC_ALL: 'C' },
  });
}

export function executeClamavLocalLab({ databaseDir = '/var/lib/clamav' } = {}) {
  const engine = run('clamscan', ['--version'], 3000);
  const sigtool = run('sigtool', ['--version'], 3000);
  const probe = {
    engineAvailable: engine.status === 0 && !engine.error,
    sigtoolAvailable: sigtool.status === 0 && !sigtool.error,
    dailySignatureAgeHours: null,
    signatureMetadataValidated: false,
    actualAvScannerExecuted: false,
    benign: null,
    eicar: null,
  };
  if (!probe.engineAvailable || !probe.sigtoolAvailable) return assessClamavLocalLab(probe);
  const signaturePath = ['daily.cld', 'daily.cvd']
    .map(name => join(databaseDir, name)).find(path => existsSync(path));
  if (!signaturePath) return assessClamavLocalLab(probe);
  try {
    const stat = statSync(signaturePath);
    if (!stat.isFile() || stat.size < 1024) return assessClamavLocalLab(probe);
    probe.dailySignatureAgeHours = (Date.now() - stat.mtimeMs) / 3600000;
    const metadata = run('sigtool', ['--info', signaturePath], 10000);
    probe.signatureMetadataValidated = metadata.status === 0 &&
      /^Version:\s*\d+/m.test(metadata.stdout ?? '') &&
      /^Signatures:\s*\d+/m.test(metadata.stdout ?? '') &&
      !metadata.error && !metadata.stderr?.trim();
  } catch {
    return assessClamavLocalLab(probe);
  }
  if (!probe.signatureMetadataValidated ||
      probe.dailySignatureAgeHours < 0 || probe.dailySignatureAgeHours > signatureMaxAgeHours) {
    return assessClamavLocalLab(probe);
  }
  // Only use a private temporary directory created by this process.
  const directory = mkdtempSync(join(tmpdir(), 'fraldacycle-fc363-'));
  try {
    const cleanPath = join(directory, 'synthetic-benign.png');
    const eicarPath = join(directory, 'synthetic-eicar-test.txt');
    writeFileSync(cleanPath, benignPng, { mode: 0o600, flag: 'wx' });
    writeFileSync(eicarPath, eicar, { mode: 0o600, flag: 'wx' });
    const options = ['--no-summary', '--database=' + databaseDir];
    probe.actualAvScannerExecuted = true;
    probe.benign = run('clamscan', [...options, cleanPath]);
    probe.eicar = run('clamscan', [...options, eicarPath]);
    return assessClamavLocalLab(probe);
  } finally {
    rmSync(directory, { force: true, recursive: true, maxRetries: 2 });
  }
}

const main = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (main) {
  const result = executeClamavLocalLab();
  // Never output clamscan stdout/stderr, file paths, EICAR bytes, or recognized text.
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'local-eicar-self-test-passed-not-homologated') process.exitCode = 2;
}
