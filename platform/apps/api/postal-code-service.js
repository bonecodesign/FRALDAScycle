import { normalizeBrazilianPostalCode } from "../../packages/contracts/postal-code-verification.js";

const BRAZILIAN_STATES = new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]);

const unavailable = () => fail("postal_provider_unavailable",503,"Não foi possível consultar o CEP agora.");
const invalidResponse = () => fail("invalid_postal_provider_response",502,"O serviço de CEP retornou uma resposta inválida.");

function optionalText(value, maxLength) {
  if (value == null) return "";
  if (typeof value !== "string") throw invalidResponse();
  const normalized = value.trim();
  if (normalized.length > maxLength || /[\u0000-\u001f\u007f]/.test(normalized)) throw invalidResponse();
  return normalized;
}

function fail(code, status, message) {
  return Object.assign(new Error(message), { code, status });
}

export function createPostalCodeService({ fetchImpl = fetch, timeoutMs = 5_000 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5_000) throw new RangeError("Invalid postal provider deadline");
  return Object.freeze({
    async lookup(value) {
      const postalCode = normalizeBrazilianPostalCode(value);
      const controller = new AbortController();
      let timer;
      // Abort alone cannot enforce a deadline if fetch or response.json() stalls.
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(unavailable()); }, timeoutMs);
      });
      const operation = (async () => {
        let response;
        try {
          response = await fetchImpl("https://viacep.com.br/ws/" + postalCode + "/json/", {
            redirect: "error",
            headers: { accept: "application/json" },
            signal: controller.signal,
          });
        } catch { throw unavailable(); }
        if (!response?.ok) throw unavailable();
        let payload;
        try { payload = await response.json(); }
        catch { throw invalidResponse(); }
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw invalidResponse();
        if (payload.erro === true) throw fail("postal_code_not_found",422,"CEP não encontrado.");
        let providerPostalCode;
        try { providerPostalCode = normalizeBrazilianPostalCode(payload.cep); }
        catch { throw invalidResponse(); }
        const city = optionalText(payload.localidade,120);
        const state = optionalText(payload.uf,2).toUpperCase();
        const street = optionalText(payload.logradouro,255);
        const district = optionalText(payload.bairro,255);
        if (providerPostalCode !== postalCode || city.length < 2 || !BRAZILIAN_STATES.has(state)) throw invalidResponse();
        return Object.freeze({
          address: Object.freeze({ postalCode,street,district,city,state }),
          evidence: Object.freeze({
            postalCode,addressVersion:1,provider:"viacep",placeId:postalCode,
            partialMatch:false,exactMatch:true,city,state,
          }),
        });
      })();
      try { return await Promise.race([operation,deadline]); }
      finally { clearTimeout(timer); }
    },
  });
}
