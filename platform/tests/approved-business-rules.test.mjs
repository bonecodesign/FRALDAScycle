import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("publishes the approved pre-operational policy set with a consolidated decision record", async () => {
  const files = await Promise.all([
    read("../docs/decisions/REGISTRO_ATUALIZACAO_2026-08-13.md"),
    read("../docs/decisions/FC-ATU-PL-001-pagamentos-logistica-doacoes.md"),
    read("../docs/product/FC-ESP-CONT-001-rodape-ajuda-servicos-impacto.md"),
    read("../docs/legal/politicas-privacidade-cookies-termos-pre-operacionais.md"),
    read("../docs/legal/politicas-operacionais-instituicoes-pre-operacionais.md"),
  ]);
  const joined = files.join("\n");
  for (const rule of [
    "8%", "2,5%", "5%", "R$ 12,90", "Pix", "cartão de crédito",
    "instituições parceiras verificadas", "pacotes abertos", "Belo Horizonte",
  ]) assert.match(joined, new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  assert.match(files[0], /campos entre colchetes/i);
  assert.match(files[0], /revisão jurídica final/i);
});

test("removes proposal and counterproposal routes from the executable app", async () => {
  const [routes, server, chat, runtime] = await Promise.all([
    read("../packages/contracts/routes.js"),
    read("../tools/dev-server.mjs"),
    read("../apps/app/chat.html"),
    read("../apps/app/negotiation.js"),
  ]);
  assert.doesNotMatch(routes, /"proposal"/);
  assert.doesNotMatch(server, /\/app\/proposal/);
  assert.doesNotMatch(chat, /Criar proposta|Posso fazer uma proposta/i);
  assert.doesNotMatch(runtime, /proposal-form|proposal-accept|contraproposta recebida/i);
});

test("keeps chat operational and gated by confirmed payment", async () => {
  const [chat, runtime, finance] = await Promise.all([
    read("../apps/app/chat.html"),
    read("../apps/app/negotiation.js"),
    read("../apps/app/finance.js"),
  ]);
  assert.match(chat, /finalidade|operacional|Condição fixa/i);
  assert.match(runtime, /\/v1\/transactions\/.*chat-access/);
  assert.doesNotMatch(runtime, /fc\.paymentConfirmed/);
  assert.match(runtime, /Chat bloqueado/);
  assert.match(runtime, /preço e as condições não podem ser alterados/i);
  assert.match(finance, /fc\.paymentConfirmed/);
});

test("publication price step does not require acceptance of proposals", async () => {
  const [page, runtime] = await Promise.all([
    read("../apps/app/publish-5.html"),
    read("../apps/app/publish.js"),
  ]);
  assert.doesNotMatch(page, /Aceito receber propostas/i);
  assert.match(page, /O preço é fixo/);
  assert.doesNotMatch(runtime, /confirme se aceita propostas/i);
  assert.match(runtime, /Informe o valor do anúncio/);
});

test("central help reflects products donations payments fees and pre-operational limits", async () => {
  const help = await read("../apps/site/help.html");
  for (const text of [
    "descartáveis infantis", "pacotes fechados", "instituições parceiras verificadas",
    "ofertas, contrapropostas ou leilões", "Pix e cartão de crédito",
    "Boleto e cartão de débito não são aceitos", "Fornecedores de pagamento e logística permanecem candidatos",
  ]) assert.match(help, new RegExp(text, "i"));
});
