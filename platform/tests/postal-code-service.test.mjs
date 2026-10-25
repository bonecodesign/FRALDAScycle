import assert from "node:assert/strict";
import test from "node:test";
import { createPostalCodeService } from "../apps/api/postal-code-service.js";

test("consulta ViaCEP no servidor e produz endereço e evidência normalizados", async () => {
  let requested;
  const service = createPostalCodeService({ fetchImpl: async (url, options) => {
    requested = { url, options };
    return { ok: true, async json() { return { cep: "30110-028", logradouro: "Avenida Afonso Pena", bairro: "Centro", localidade: "Belo Horizonte", uf: "mg" }; } };
  } });
  const result = await service.lookup("30110-028");
  assert.equal(requested.url, "https://viacep.com.br/ws/30110028/json/");
  assert.equal(requested.options.headers.accept, "application/json");
  assert.deepEqual(result.address, { postalCode: "30110028", street: "Avenida Afonso Pena", district: "Centro", city: "Belo Horizonte", state: "MG" });
  assert.equal(result.evidence.provider, "viacep");
  assert.equal(result.evidence.exactMatch, true);
});

test("falha fechada para CEP inexistente, resposta divergente e indisponibilidade", async () => {
  const missing = createPostalCodeService({ fetchImpl: async () => ({ ok: true, async json() { return { erro: true }; } }) });
  await assert.rejects(missing.lookup("30110028"), error => error.code === "postal_code_not_found" && error.status === 422);
  const mismatch = createPostalCodeService({ fetchImpl: async () => ({ ok: true, async json() { return { cep: "30110-029", localidade: "Belo Horizonte", uf: "MG" }; } }) });
  await assert.rejects(mismatch.lookup("30110028"), error => error.code === "invalid_postal_provider_response" && error.status === 502);
  const unavailable = createPostalCodeService({ fetchImpl: async () => { throw new Error("offline"); } });
  await assert.rejects(unavailable.lookup("30110028"), error => error.code === "postal_provider_unavailable" && error.status === 503);
});
