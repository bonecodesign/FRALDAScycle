import test from 'node:test';
import assert from 'node:assert/strict';
import { assessClamavLocalLab } from '../tools/media-local-antivirus-lab.mjs';

const passingMock = () => ({
  engineAvailable: true,
  sigtoolAvailable: true,
  signatureMetadataValidated: true,
  dailySignatureAgeHours: 4,
  actualAvScannerExecuted: true,
  benign: { status: 0, stdout: '/tmp/synthetic-benign.png: OK\n', stderr: '', signal: null },
  eicar: { status: 1, stdout: '/tmp/synthetic-eicar-test.txt: Eicar-Test-Signature FOUND\n', stderr: '', signal: null },
});

test('FC-363: a mocked scanner acceptance never grants a production go', () => {
  const r = assessClamavLocalLab(passingMock());
  assert.equal(r.status, 'local-eicar-self-test-passed-not-homologated');
  assert.equal(r.checks.benignSyntheticImage, 'passed');
  assert.equal(r.checks.eicarHarmlessTestDetected, 'passed');
  assert.equal(r.reusableProviderScanStatus, null);
  assert.equal(r.officialMediaGatesPromoted, false);
  assert.equal(r.operationalReleaseAllowed, false);
  assert.equal(r.newSpendingBrl, 0);
  assert.doesNotMatch(JSON.stringify(r), /Eicar-Test-Signature|synthetic-eicar-test/);
});

test('FC-363: missing scanner, signatures and execution block self-test', () => {
  for (const patch of [
    { engineAvailable: false }, { sigtoolAvailable: false },
    { signatureMetadataValidated: false }, { dailySignatureAgeHours: null },
    { dailySignatureAgeHours: -1 }, { dailySignatureAgeHours: 72.01 },
    { actualAvScannerExecuted: false },
    { benign: null }, { eicar: null },
  ]) {
    const report = assessClamavLocalLab({...passingMock(), ...patch});
    assert.equal(report.status, 'blocked-no-antivirus-clearance', JSON.stringify(patch));
    assert.equal(report.reusableProviderScanStatus, null);
  }
});

test('FC-363: no false OK from infected image, ignored EICAR, timeout, warnings or extra output', () => {
  for (const patch of [
    { benign: { status: 1, stdout: '/tmp/a: Unexpected-Signature FOUND\n', stderr: '' } },
    { benign: { status: 0, stdout: '/tmp/a: OK\n/tmp/b: OK\n', stderr: '' } },
    { benign: { status: 0, stdout: '/tmp/a: OK\n', stderr: 'WARNING: outdated' } },
    { benign: { status: null, stdout: '', stderr: '', signal: 'SIGTERM' } },
    { eicar: { status: 0, stdout: '/tmp/b: OK\n', stderr: '' } },
    { eicar: { status: 2, stdout: '/tmp/b: ERROR\n', stderr: '' } },
    { eicar: { status: 1, stdout: '/tmp/b: Another-Signature FOUND\n', stderr: '' } },
    { eicar: { status: 1, stdout: '/tmp/b: Eicar-Test-Signature FOUND\n', stderr: 'WARNING' } },
    { eicar: { status: 1, stdout: '/tmp/b: Eicar-Test-Signature FOUND\n', stderr: '', error: new Error('connection broken') } },
  ]) {
    assert.equal(assessClamavLocalLab({...passingMock(),...patch}).status,
      'blocked-no-antivirus-clearance',
      JSON.stringify(patch, (_, v) => v instanceof Error ? v.message : v));
  }
});

test('FC-363: absent probe fails closed, and stdout does not leak scanner findings', () => {
  const r = assessClamavLocalLab();
  assert.equal(r.status, 'blocked-no-antivirus-clearance');
  assert.equal(r.actualAvScannerExecuted, false);
  assert.deepEqual(Object.values(r.checks), Array(5).fill('blocked'));
  assert.equal(r.rawScanOutputPersisted, false);
});
