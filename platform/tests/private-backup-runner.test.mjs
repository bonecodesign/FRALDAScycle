import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const folder = new URL("../infra/private-backup-runner/", import.meta.url);

test("private backup template is dormant, manual-only, secret-scoped and pinned", async () => {
  const yaml = await readFile(new URL("manual-offsite-backup.workflow.yml", folder), "utf8");
  assert.match(yaml, /\bon:\s*\n\s+workflow_dispatch:/);
  assert.doesNotMatch(yaml, /^\s+(schedule|push|pull_request|repository_dispatch):/m);
  assert.match(yaml, /github\.event\.repository\.private/);
  assert.match(yaml, /github\.repository == 'bonecodesign\/fraldacycle-backups-private'/);
  assert.match(yaml, /BACKUP_FRALDACYCLE_BR/);
  assert.match(yaml, /permissions:\s*\n\s+contents: read/);
  assert.match(yaml, /cancel-in-progress: false/);
  assert.match(yaml, /REPLACE_WITH_REVIEWED_40_CHARACTER_SHA/);
  assert.match(yaml, /git -C source rev-parse HEAD/);
  assert.match(yaml, /secrets\.FC_BR_DATABASE_URL/);
  assert.match(yaml, /secrets\.FC_BACKUP_ENCRYPTION_KEY_B64/);
  assert.match(yaml, /secrets\.FC_DROPBOX_REFRESH_TOKEN/);
  assert.doesNotMatch(yaml.split("\n").filter(line => !line.trimStart().startsWith("#")).join("\n"), /\b(upload-artifact|schedule|pg_restore|npm publish)\b/);
});

test("private backup Bash runner is syntactically valid and does not store original dump in Dropbox", async () => {
  const script = new URL("run-private-backup.sh", folder);
  const parsed = spawnSync("bash", ["-n", script.pathname], { encoding: "utf8" });
  assert.equal(parsed.status, 0, parsed.stderr);
  const contents = await readFile(script, "utf8");
  assert.match(contents, /trap 'rm -rf -- "\$private_workdir"' EXIT/);
  assert.match(contents, /GITHUB_REPOSITORY:-}" != "bonecodesign\/fraldacycle-backups-private"/);
  assert.match(contents, /NODE_ENV:-/);
  assert.match(contents, /pg_dump.*Docker|pg_dump.*postgres|--entrypoint pg_dump postgres:17-alpine/s);
  assert.match(contents, /source\/platform\/database\/recovery\.js backup/);
  assert.match(contents, /--entrypoint psql postgres:17-alpine/);
  assert.match(contents, /source\/platform\/tools\/storage-binary-coverage-preflight\.mjs/);
  assert.ok(contents.indexOf("tools/storage-binary-coverage-preflight.mjs") <
    contents.indexOf("database/recovery.js backup"));
  assert.match(contents, /Storage metadata rows but NOT file bytes/);
  assert.match(contents, /validateBackupProtectionFiles/);
  assert.match(contents, /--entrypoint pg_restore postgres:17-alpine --list/);
  assert.match(contents, /--network none --read-only/);
  assert.match(contents, /source\/platform\/tools\/backup-toc-coverage\.mjs/);
  assert.ok(contents.indexOf("backup-toc-coverage.mjs") <
    contents.indexOf("database/recovery-archive.js encrypt"));
  assert.match(contents, /source\/platform\/database\/recovery-archive\.js encrypt/);
  assert.match(contents, /source\/platform\/database\/recovery-archive\.js verify/);
  assert.match(contents, /source\/platform\/tools\/dropbox-encrypted-upload\.mjs/);
  assert.match(contents, /rm -f -- "\$DATABASE_DUMP_PATH"/);
  assert.doesNotMatch(contents, /\bdocker push\b|\bnpm publish\b|--clean|--dbname|CONFIRM_DATABASE_RESTORE|\bset -x\b/);
});
