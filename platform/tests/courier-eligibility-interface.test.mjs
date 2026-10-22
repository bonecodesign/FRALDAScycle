import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../apps/app/courier-home.html", import.meta.url), "utf8");
const script = await readFile(new URL("../apps/app/courier-eligibility.js", import.meta.url), "utf8");

test("courier home exposes an accessible live eligibility region", () => {
  assert.match(html, /id="courier-eligibility"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /id="courier-eligibility-feedback" role="status" aria-live="polite"/);
  assert.match(html, /courier-eligibility\.js/);
});

test("interface covers eligible, suspended, provisional and priority states", () => {
  for (const state of ["Cadastro elegível", "Cadastro suspenso", "Liberação provisória", "Em análise prioritária"]) {
    assert.match(script, new RegExp(state));
  }
  assert.match(script, /Novas ofertas/);
  assert.match(script, /entregas já atribuídas continuam disponíveis/i);
});

test("support request is explicit, server-backed and has no client supplied deadline", () => {
  assert.match(script, /\/v1\/courier\/eligibility\/support-release/);
  assert.match(script, /crypto\.randomUUID\(\)/);
  assert.doesNotMatch(script, /openedAt|supportDueAt|supervisorDueAt/);
});
