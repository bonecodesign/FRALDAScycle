import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("incident console exposes governed privacy assessment without external dispatch", async () => {
  const [html, source] = await Promise.all([
    readFile(new URL("../apps/admin/operations.html", import.meta.url), "utf8"),
    readFile(new URL("../apps/admin/incident-console.js", import.meta.url), "utf8"),
  ]);
  assert.match(html, /option value="privacy">Privacidade e dados/);
  assert.match(source, /assess_privacy/);
  assert.match(source, /record_communication/);
  assert.match(source, /preliminary_notice_required/);
  assert.doesNotMatch(source, /fetch\(['"]https?:|graph\.facebook|sendEmail|sendMessage/);
});
