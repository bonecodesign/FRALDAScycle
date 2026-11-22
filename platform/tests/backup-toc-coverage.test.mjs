import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MIN_PUBLIC_TABLES, REQUIRED_BACKUP_TABLES, inspectBackupToc, inspectPrivateTocFile,
} from "../tools/backup-toc-coverage.mjs";

function fixture({ absent = [], absentData = [], publicCount = MIN_PUBLIC_TABLES,
  format = "CUSTOM" } = {}) {
  const required = REQUIRED_BACKUP_TABLES.filter(x => x.startsWith("public."));
  const otherPublic = Array.from({ length: Math.max(0, publicCount - required.length) },
    (_, i) => `public.other_table_${i}`);
  const all = [...REQUIRED_BACKUP_TABLES, ...otherPublic];
  let id = 1;
  const rows = [
    ";",
    "; Archive created at 2026-11-22 17:00:00 UTC",
    `;     Format: ${format}`,
    `;     TOC Entries: ${all.length * 2}`,
    ";",
  ];
  for (const key of all) {
    const [schema, name] = key.split(".");
    if (!absent.includes(key)) rows.push(`${id++}; 1259 10000 TABLE ${schema} ${name} synthetic_owner`);
    if (!absentData.includes(key)) rows.push(`${id++}; 0 10000 TABLE DATA ${schema} ${name} synthetic_owner`);
  }
  return rows.join("\n") + "\n";
}

test("complete synthetic custom dump includes minimum 166 public tables plus Auth/Storage", () => {
  const report = inspectBackupToc(fixture());
  assert.equal(report.status, "BACKUP_TOC_STRUCTURE_PRESENT");
  assert.equal(report.publicTableDefinitions, MIN_PUBLIC_TABLES);
  assert.equal(report.essentialDataEntries, REQUIRED_BACKUP_TABLES.length);
  assert.equal(report.rowDataValidated, false);
  assert.equal(report.restorationValidated, false);
  assert.equal(report.storageObjectContentsValidated, false);
});

test("blocks dumps with missing auth, storage and essential application definitions", () => {
  for (const key of REQUIRED_BACKUP_TABLES) {
    assert.throws(() => inspectBackupToc(fixture({ absent: [key] })),
      /BACKUP_TOC_ESSENTIAL_TABLE_MISSING|BACKUP_TOC_PUBLIC_TABLE_COUNT_LOW/);
    assert.throws(() => inspectBackupToc(fixture({ absentData: [key] })),
      /BACKUP_TOC_ESSENTIAL_TABLE_MISSING/);
  }
});

test("blocks partial public exports and non-custom or malformed TOC", () => {
  assert.throws(() => inspectBackupToc(fixture({ publicCount: MIN_PUBLIC_TABLES - 1 })),
    /BACKUP_TOC_PUBLIC_TABLE_COUNT_LOW/);
  assert.throws(() => inspectBackupToc(fixture({ format: "PLAIN" })),
    /BACKUP_TOC_FORMAT_UNSUPPORTED/);
  assert.throws(() => inspectBackupToc("; no TOC header\n"),
    /BACKUP_TOC_FORMAT_UNSUPPORTED/);
  assert.throws(() => inspectBackupToc(25), /BACKUP_TOC_INVALID_CONTENT/);
});

test("cannot spoof structural coverage using comments with fake TABLE lines", () => {
  const data = fixture({ absentData: ["storage.objects"] }) +
    "; 999; 0 10000 TABLE DATA storage objects postgres\n" +
    "-- 999; 0 10000 TABLE DATA storage objects postgres\n";
  assert.throws(() => inspectBackupToc(data), /BACKUP_TOC_ESSENTIAL_TABLE_MISSING/);
});

test("rejects non-private TOC files, accepts a private synthetic TOC and CLI", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fc343-toc-"));
  try {
    const path = join(directory, "manifest.toc");
    await writeFile(path, fixture(), { mode: 0o600 });
    assert.equal((await inspectPrivateTocFile(path)).status, "BACKUP_TOC_STRUCTURE_PRESENT");
    const result = spawnSync(process.execPath, ["tools/backup-toc-coverage.mjs", path], {
      cwd: new URL("../", import.meta.url).pathname,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).restorationValidated, false);
    await chmod(path, 0o644);
    await assert.rejects(inspectPrivateTocFile(path), /BACKUP_TOC_PRIVATE_FILE_REQUIRED/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("does not claim real rows or an isolated recovery even with all TOC entries", () => {
  const result = inspectBackupToc(fixture());
  assert.equal(result.rowDataValidated, false);
  assert.equal(result.restorationValidated, false);
  assert.equal(result.storageObjectContentsValidated, false);
});
