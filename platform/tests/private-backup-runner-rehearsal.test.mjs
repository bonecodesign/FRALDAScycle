import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const runner = fileURLToPath(new URL("../infra/private-backup-runner/run-private-backup.sh", import.meta.url));

async function rehearse({ failAtGate = 0, blankSecret = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), "fc346-runner-"));
  const bin = join(root, "bin");
  const temp = join(root, "runner-temp");
  await chmod(root, 0o700);
  await mkdir(bin, { mode: 0o700 });
  await mkdir(temp, { mode: 0o700 });
  const events = join(root, "events.txt");
  const counter = join(root, "counter.txt");
  const mockNode = [
    '#!/usr/bin/env bash',
    'set -Eeuo pipefail',
    'if [[ "$1" == "--input-type=module" ]]; then echo "validate" >> "$MOCK_EVENTS"; exit 0; fi',
    'case "$*" in',
    '  *storage-binary-coverage-preflight.mjs*)',
    '    value="$(cat "$MOCK_COUNTER" 2>/dev/null || echo 0)"',
    '    value="$((value + 1))"',
    '    echo "$value" > "$MOCK_COUNTER"',
    '    echo "storage-$value" >> "$MOCK_EVENTS"',
    '    [[ "$value" != "$MOCK_FAIL_GATE" ]] || exit 93',
    '    ;;',
    '  *database/recovery.js\\ backup*)',
    '    echo "backup" >> "$MOCK_EVENTS"',
    '    printf "FAKE_DUMP_DO_NOT_USE\\n" > "$DATABASE_DUMP_PATH"',
    '    printf "%064d\\n" 0 > "$DATABASE_DUMP_PATH.sha256"',
    '    ;;',
    '  *tools/backup-toc-coverage.mjs*)',
    '    [[ -s "$2" ]] || exit 92',
    '    echo "toc" >> "$MOCK_EVENTS"',
    '    ;;',
    '  *database/recovery-archive.js\\ encrypt*)',
    '    echo "encrypt" >> "$MOCK_EVENTS"',
    '    printf "FAKE_CIPHERTEXT_DO_NOT_USE\\n" > "$RECOVERY_ENCRYPTED_PATH"',
    '    printf "%064d\\n" 0 > "$RECOVERY_ENCRYPTED_PATH.sha256"',
    '    ;;',
    '  *database/recovery-archive.js\\ verify*)',
    '    [[ -f "$RECOVERY_ENCRYPTED_PATH" ]] || exit 91',
    '    echo "verify" >> "$MOCK_EVENTS"',
    '    ;;',
    '  *tools/dropbox-encrypted-upload.mjs*)',
    '    [[ -f "$RECOVERY_ENCRYPTED_PATH" ]] || exit 90',
    '    [[ ! -f "$DATABASE_DUMP_PATH" ]] || exit 89',
    '    echo "upload-mock" >> "$MOCK_EVENTS"',
    '    ;;',
    '  *) echo "Unexpected fake Node invocation" >&2; exit 88 ;;',
    'esac',
  ].join("\n") + "\n";
  const mockDocker = [
    '#!/usr/bin/env bash',
    'set -Eeuo pipefail',
    'case " $* " in',
    '  *" --entrypoint pg_restore "*)',
    '    echo "toc-index-mock" >> "$MOCK_EVENTS"',
    '    printf "; Format: CUSTOM\\n; TOC Entries: 1\\n1; 1259 10000 TABLE public synthetic postgres\\n"',
    '    ;;',
    '  *) echo "No real Docker access permitted" >&2; exit 87 ;;',
    'esac',
  ].join("\n") + "\n";
  await writeFile(join(bin, "node"), mockNode, { mode: 0o700 });
  await writeFile(join(bin, "docker"), mockDocker, { mode: 0o700 });
  const env = {
    ...process.env,
    PATH: bin + ":" + (process.env.PATH || "/usr/bin:/bin"),
    HOME: root,
    NODE_ENV: "test",
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: "bonecodesign/fraldacycle-backups-private",
    PRIVATE_BACKUP_RUNNER_APPROVED: "MANUAL_HOMOLOGATION",
    OFFSITE_BACKUP_UPLOAD_APPROVED: "PRIVATE_RUNNER_MANUAL",
    FC_DROPBOX_ACCESS_POLICY: "APP_FOLDER_ONLY",
    DATABASE_URL: "postgresql://synthetic:dummy@db.invalid:5432/postgres",
    FC_DB_CA_PEM: "-----BEGIN CERTIFICATE-----\nsynthetic\n-----END CERTIFICATE-----",
    RECOVERY_ARCHIVE_KEY_B64: "TEST_ONLY_NOT_A_REAL_KEY",
    DROPBOX_APP_KEY: "TEST_ONLY",
    DROPBOX_APP_SECRET: "TEST_ONLY",
    DROPBOX_REFRESH_TOKEN: blankSecret ? "" : "TEST_ONLY",
    RUNNER_TEMP: temp,
    GITHUB_RUN_ID: "1234",
    GITHUB_RUN_ATTEMPT: "1",
    MOCK_EVENTS: events,
    MOCK_COUNTER: counter,
    MOCK_FAIL_GATE: String(failAtGate),
  };
  const result = spawnSync("bash", [runner], {
    env, encoding: "utf8", timeout: 12_000, maxBuffer: 64 * 1024,
  });
  const log = await readFile(events, "utf8").catch(() => "");
  const remaining = await readdir(temp);
  await rm(root, { recursive: true, force: true });
  return { ...result, stages: log.trim().split("\n").filter(Boolean), remaining };
}

test("FC-346 rehearses the complete Bash flow with no database, Docker daemon or network", async () => {
  const outcome = await rehearse();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.deepEqual(outcome.stages, [
    "validate", "storage-1", "backup", "toc-index-mock", "toc",
    "storage-2", "encrypt", "verify", "storage-3", "upload-mock", "storage-4",
  ]);
  assert.match(outcome.stdout, /PRIVATE_BACKUP_FINISHED_ENCRYPTED_OFFSITE/);
  assert.deepEqual(outcome.remaining, [], "private temporary files must be cleaned up");
});

test("FC-346 failure after dump prevents encryption and upload", async () => {
  const outcome = await rehearse({ failAtGate: 2 });
  assert.notEqual(outcome.status, 0);
  assert.deepEqual(outcome.stages, [
    "validate", "storage-1", "backup", "toc-index-mock", "toc", "storage-2",
  ]);
  assert.doesNotMatch(outcome.stdout, /PRIVATE_BACKUP_FINISHED/);
  assert.deepEqual(outcome.remaining, []);
});

test("FC-346 failure after upload prevents the success receipt", async () => {
  const outcome = await rehearse({ failAtGate: 4 });
  assert.notEqual(outcome.status, 0);
  assert.ok(outcome.stages.includes("upload-mock"));
  assert.equal(outcome.stages.at(-1), "storage-4");
  assert.doesNotMatch(outcome.stdout, /PRIVATE_BACKUP_FINISHED/);
  assert.deepEqual(outcome.remaining, []);
});

test("FC-346 missing protected secret stops before first operation", async () => {
  const outcome = await rehearse({ blankSecret: true });
  assert.notEqual(outcome.status, 0);
  assert.deepEqual(outcome.stages, []);
  assert.match(outcome.stderr, /PRIVATE_BACKUP_MISSING_PROTECTED_CONFIGURATION/);
  assert.doesNotMatch(outcome.stderr, /TEST_ONLY_NOT_A_REAL_KEY/);
  assert.deepEqual(outcome.remaining, []);
});
