import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../apps/admin/ads.html", import.meta.url), "utf8");
const script = await readFile(new URL("../apps/admin/manufacturer-catalog-admin.js", import.meta.url), "utf8");

test("admin ads exposes governed catalog import and independent review controls", () => {
  assert.match(html, /id="manufacturer-catalog-import"/);
  assert.match(html, /name="documentSha256"[^>]+\{64\}/);
  assert.match(html, /accept="\.csv,text\/csv"/);
  assert.match(html, /Duas revisões independentes/i);
  assert.match(html, /id="manufacturer-catalog-review"/);
  assert.match(html, /name="confirmed"[^>]+required/);
  assert.match(html, /manufacturer-catalog-admin\.js/);
});

test("admin catalog client uses server workflow without activating a batch locally", () => {
  assert.match(script, /MAX_CSV_BYTES = 5_000_000/);
  assert.match(script, /\/v1\/admin\/manufacturer-catalog\/batches/);
  assert.match(script, /\/v1\/admin\/manufacturer-catalog\/imports/);
  assert.match(script, /expectedVersion: selectedBatch\.version/);
  assert.match(script, /confirmed: true/);
  assert.doesNotMatch(script, /selectedBatch\.status\s*=\s*["']active["']/);
  assert.doesNotMatch(script, /status\s*:\s*["']active["']/);
});
