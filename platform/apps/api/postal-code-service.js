import { normalizeBrazilianPostalCode } from "../../packages/contracts/postal-code-verification.js";

function fail(code, status, message) {
  return Object.assign(new Error(message), { code, status });
}

export function createPostalCodeService({ fetchImpl = fetch, timeoutMs = 5_000 } = {}) {
  return Object.freeze({
    async lookup(value) {
      const postalCode = normalizeBrazilianPostalCode(value);
      let response;
      try {
        response = await fetchImpl(`https://viacep.com.br/ws/${postalCode}/json/`, {
          headers: { accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw fail("postal_provider_unavailable", 503, "Não foi possível consultar o CEP agora.");
      }
      if (!response?.ok) throw fail("postal_provider_unavailable", 503, "Não foi possível consultar o CEP agora.");
      let payload;
      try { payload = await response.json(); }
      catch { throw fail("invalid_postal_provider_response", 502, "O serviço de CEP retornou uma resposta inválida."); }
      if (payload?.erro === true) throw fail("postal_code_not_found", 422, "CEP não encontrado.");
      let providerPostalCode;
      try { providerPostalCode = normalizeBrazilianPostalCode(payload?.cep); }
      catch { throw fail("invalid_postal_provider_response", 502, "O serviço de CEP retornou uma resposta inválida."); }
      const city = String(payload?.localidade ?? "").trim();
      const state = String(payload?.uf ?? "").trim().toUpperCase();
      if (providerPostalCode !== postalCode || city.length < 2 || !/^[A-Z]{2}$/.test(state)) {
        throw fail("invalid_postal_provider_response", 502, "O serviço de CEP retornou uma resposta inválida.");
      }
      return Object.freeze({
        address: Object.freeze({
          postalCode,
          street: String(payload.logradouro ?? "").trim(),
          district: String(payload.bairro ?? "").trim(),
          city,
          state,
        }),
        evidence: Object.freeze({
          postalCode,
          addressVersion: 1,
          provider: "viacep",
          placeId: postalCode,
          partialMatch: false,
          exactMatch: true,
          city,
          state,
        }),
      });
    },
  });
}
