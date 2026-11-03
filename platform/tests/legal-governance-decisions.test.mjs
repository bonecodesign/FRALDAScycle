import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = relative => readFile(new URL(relative, import.meta.url), "utf8");

test("founder legal decisions remain distinct from professional approval", async () => {
  const [decisions, impacts] = await Promise.all([
    read("../docs/decisions/FC-DEC-2026-11-03-governanca-juridica-produto.md"),
    read("../docs/legal/mapa-impactos-decisoes-juridicas-2026-11-03.md"),
  ]);
  assert.match(decisions, /não é parecer jurídico/i);
  assert.match(decisions, /O projeto permanece NO-GO/i);
  assert.match(decisions, /O último perfil \*\*pode\*\* ser removido/);
  assert.match(decisions, /checklist e aprovação formal de Jurídico, Privacidade, Segurança, Financeiro\/Contabilidade/);
  assert.match(impacts, /não representa parecer profissional nem eleva o percentual formal/i);
  assert.match(impacts, /“Decidido” não significa “implementado”, “contratado”, “validado” ou “ativo”/);
});

test("legal drafts cannot be mistaken for effective documents", async () => {
  const drafts = await Promise.all([
    read("../docs/legal/rascunho-termos-de-uso-v2.md"),
    read("../docs/legal/rascunho-politica-de-privacidade-v2.md"),
    read("../docs/legal/rascunho-politicas-operacionais-v2.md"),
  ]);
  for (const draft of drafts) assert.match(draft, /pré-operacional/i);
  assert.match(drafts[0], /\[RAZÃO SOCIAL\]/);
  assert.match(drafts[1], /\[ENCARREGADO\]/);
  assert.match(drafts[2], /Fase 1: convite, sem dinheiro real/);
});

