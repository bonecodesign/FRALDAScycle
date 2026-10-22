import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../apps/admin/admin-overview.js", import.meta.url), "utf8");

test("dashboard distingue momento da consulta de atualização na origem", () => {
  assert.match(source, /Última consulta bem-sucedida nesta tela:/);
  assert.match(source, /não indica atualização dos dados na origem/);
  assert.match(source, /new Intl\.DateTimeFormat\("pt-BR"/);
});

test("dashboard limpa valores e detalhes após falha de consulta", () => {
  assert.match(source, /catch \(error\) \{\s*currentResult = null;/);
  assert.match(source, /set\(id, "—"\)/);
  assert.match(source, /overview-rows"\)\?\.replaceChildren\(\)/);
  assert.match(source, /verified-alert-list"\)\?\.replaceChildren\(\)/);
  assert.match(source, /Pendências indisponíveis nesta consulta/);
});

test("exportação fica indisponível durante erro e sem resultado válido", () => {
  assert.match(source, /if \(!currentResult\) return;/);
  assert.match(source, /if \(exportButton\) exportButton.disabled = true;/);
});

test("indicadores ausentes não são apresentados como zero financeiro ou operacional", () => {
  assert.match(source, /value == null \? "—" : Number\(value\)\.toLocaleString/);
  assert.match(source, /value == null \? "—" : money\.format/);
});
