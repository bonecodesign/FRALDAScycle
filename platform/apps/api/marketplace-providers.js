import { validateExternalProviderEndpoint } from "./external-provider-endpoint.js";
import { ServiceError } from "./service-error.js";
import {CONTENT_RULE_VERSION} from '../../packages/contracts/content-moderation.js';
export class ProviderError extends ServiceError {
  constructor(code, status, message) {
    super(code, status, message);
  }
}

function configured(endpoint, secret, name) {
  if (!endpoint || !secret) {
    throw new ProviderError("provider_not_configured", 503, `${name} ainda não foi configurado.`);
  }
  // Defense in depth for adapters built without loadConfig(): never send a
  // Bearer secret to an accidentally local, IP or credential-embedded URL.
  try { validateExternalProviderEndpoint(endpoint, "PROVIDER_ENDPOINT"); }
  catch { throw new ProviderError("provider_not_configured", 503, `${name} possui configuração inválida.`); }
}

function httpsUrl(value, field) {
  let url;
  try { url = new URL(value); } catch { throw new ProviderError("invalid_provider_response", 502, `Resposta inválida do provedor: ${field}.`); }
  if (url.protocol !== "https:") throw new ProviderError("invalid_provider_response", 502, `O provedor deve retornar HTTPS em ${field}.`);
  return url.toString();
}

async function providerRequest(endpoint, secret, payload, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  let timer;
  // AbortSignal alone cannot enforce a deadline against a provider adapter
  // that ignores aborts, nor against a stalled response.json() stream.
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ProviderError("provider_unavailable", 503, "Integração externa temporariamente indisponível."));
    }, timeoutMs);
  });
  const operation = (async () => {
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        redirect: "error",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secret}`,
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch {
      throw new ProviderError("provider_unavailable", 503, "Integração externa temporariamente indisponível.");
    }
    if (!response?.ok) throw new ProviderError("provider_rejected", 502, "O provedor externo recusou a solicitação.");
    let result;
    try { result = await response.json(); }
    catch { throw new ProviderError("invalid_provider_response", 502, "O provedor retornou uma resposta inválida."); }
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new ProviderError("invalid_provider_response", 502, "O provedor retornou uma resposta inválida.");
    }
    return result;
  })();
  try { return await Promise.race([operation, deadline]); }
  finally { clearTimeout(timer); }
}

export function createMarketplaceProviders(config, fetchImpl = fetch, { timeoutMs = 8_000 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 8_000) throw new RangeError('Invalid media provider deadline');
  return Object.freeze({
    async signedListingRead(userId, input) {
      const storageKey=input?.storageKey;
      if(typeof storageKey!=='string'||!storageKey.startsWith(`listings/${userId}/`)||
          !/^[a-zA-Z0-9._/-]{8,512}$/.test(storageKey)||storageKey.includes('..')) {
        throw new ProviderError('invalid_media',422,'Escolha uma foto enviada pela sua conta.');
      }
      await this.verifyListingMedia(userId,[storageKey]);
      return this.signedProofRead(userId,storageKey);
    },
    async verifyListingMedia(ownerId, storageKeys) {
      configured(config.mediaProviderUrl, config.mediaProviderSecret, "O armazenamento de mídia");
      if (!Array.isArray(storageKeys) || storageKeys.length < 1 || storageKeys.length > 8 ||
          new Set(storageKeys).size !== storageKeys.length || storageKeys.some(key =>
            typeof key !== "string" || !key.startsWith(`listings/${ownerId}/`) ||
            !/^[a-zA-Z0-9._/-]{1,512}$/.test(key) || key.includes(".."))) {
        throw new ProviderError("invalid_media", 422, "As fotos do anúncio são inválidas.");
      }
      for (const storageKey of storageKeys) {
        const result = await providerRequest(config.mediaProviderUrl, config.mediaProviderSecret, {
          operation: "verify-listing-media", ownerId, storageKey,
          contactRuleVersion:CONTENT_RULE_VERSION,requireOcr:true,requireQrDetection:true,storeOcrText:false,
        }, fetchImpl, timeoutMs);
        if (result?.storageKey !== storageKey || result.ownerId !== ownerId ||
            result.exists !== true || result.processed !== true || result.immutable !== true ||
            result.contentType !== "image/webp" || result.exifRemoved !== true || result.scanStatus !== "clean" ||
            result.contactScanStatus !== "clear" || result.contactRuleVersion !== CONTENT_RULE_VERSION ||
            result.ocrTextStored !== false || result.qrCodeDetected !== false ||
            !Array.isArray(result.contactReasons) || result.contactReasons.length !== 0 ||
            !Number.isInteger(result.sizeBytes) || result.sizeBytes < 1 || result.sizeBytes > 10_000_000 ||
            !Number.isInteger(result.width) || result.width < 1 || result.width > 1_600 ||
            !Number.isInteger(result.height) || result.height < 1 || result.height > 1_600) {
          throw new ProviderError("media_not_ready", 409, "Uma ou mais fotos ainda não foram processadas ou confirmadas. Tente novamente após o processamento.");
        }
      }
      return { verified: true, count: storageKeys.length };
    },
    async signedProofRead(userId, storageKey) {
      configured(config.mediaProviderUrl, config.mediaProviderSecret, "O armazenamento de mídia");
      if (!/^[a-zA-Z0-9._/-]{8,512}$/.test(storageKey) || storageKey.includes("..")) {
        throw new ProviderError("invalid_proof_media", 422, "Chave do comprovante inválida.");
      }
      const result = await providerRequest(config.mediaProviderUrl, config.mediaProviderSecret, {
        operation: "signed-read", requesterId: userId, storageKey, expiresInSeconds: 300,
      }, fetchImpl, timeoutMs);
      const expiresAt = Date.parse(result.expiresAt);
      const now = Date.now();
      if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + 300_000) {
        throw new ProviderError("invalid_provider_response", 502, "Prazo de acesso ao comprovante inválido.");
      }
      const url = new URL(httpsUrl(result.readUrl, "readUrl"));
      if (url.username || url.password) throw new ProviderError("invalid_provider_response", 502, "Endereço do comprovante inválido.");
      return { readUrl: url.toString(), expiresAt: new Date(expiresAt).toISOString() };
    },
    async signedUpload(userId, input) {
      configured(config.mediaProviderUrl, config.mediaProviderSecret, "O armazenamento de mídia");
      const contentType = typeof input?.contentType === "string" ? input.contentType : "";
      const sizeBytes = input?.sizeBytes;
      if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
        throw new ProviderError("invalid_media_type", 422, "Envie uma imagem JPEG, PNG ou WebP.");
      }
      if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 10_000_000) {
        throw new ProviderError("invalid_media_size", 422, "A imagem deve ter no máximo 10 MB.");
      }
      const result = await providerRequest(config.mediaProviderUrl, config.mediaProviderSecret, {
        operation: "signed-upload", ownerId: userId, contentType, sizeBytes,
      }, fetchImpl, timeoutMs);
      const storageKey = String(result.storageKey ?? "");
      if (!storageKey.startsWith(`listings/${userId}/`) ||
          !/^[a-zA-Z0-9._/-]{1,512}$/.test(storageKey) || storageKey.includes("..")) {
        throw new ProviderError("invalid_provider_response", 502, "O provedor retornou uma chave de mídia inválida.");
      }
      const uploadUrl = new URL(httpsUrl(result.uploadUrl, "uploadUrl"));
      if (uploadUrl.username || uploadUrl.password) {
        throw new ProviderError("invalid_provider_response", 502, "Endereço de upload inválido.");
      }
      const expiresAt = Date.parse(result.expiresAt);
      const now = Date.now();
      if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + 15 * 60_000) {
        throw new ProviderError("invalid_provider_response", 502, "Prazo de upload inválido.");
      }
      const headers = {};
      if (result.headers != null && (typeof result.headers !== "object" || Array.isArray(result.headers))) {
        throw new ProviderError("invalid_provider_response", 502, "Cabeçalhos de upload inválidos.");
      }
      for (const [name, value] of Object.entries(result.headers ?? {})) {
        const normalized = name.toLowerCase();
        if (["authorization", "cookie", "host", "origin"].includes(normalized) ||
            typeof value !== "string" || value.length > 2_048 || /[\r\n]/.test(value)) {
          throw new ProviderError("invalid_provider_response", 502, "Cabeçalhos de upload inválidos.");
        }
        headers[normalized] = value;
      }
      return {
        uploadUrl: uploadUrl.toString(),
        storageKey,
        expiresAt: new Date(expiresAt).toISOString(),
        headers,
      };
    },

    async geocode(userId, input) {
      configured(config.geocodingProviderUrl, config.geocodingProviderSecret, "A geocodificação");
      // Reject objects coerced to "[object Object]" and other ambiguous addresses.
      const address = typeof input?.address === "string" ? input.address.trim() : "";
      if (address.length < 5 || address.length > 300) {
        throw new ProviderError("invalid_address", 422, "Informe um endereço válido.");
      }
      const result = await providerRequest(config.geocodingProviderUrl, config.geocodingProviderSecret, {
        operation: "geocode", requesterId: userId, address, country: "BR",
      }, fetchImpl, timeoutMs);
      // Number(null), Number("") and Number(false) are 0. Never convert a
      // missing or ambiguous provider value into a valid geographic coordinate.
      // The provider contract requires JSON numbers, not numeric strings.
      const latitude = result.latitude;
      const longitude = result.longitude;
      if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
          typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        throw new ProviderError("invalid_provider_response", 502, "O provedor retornou coordenadas inválidas.");
      }
      // Never turn arbitrary objects, foreign state codes or long city names
      // into apparently valid Brazilian localities by String()/slice().
      const city = result.city == null || result.city === "" ? null : result.city;
      const state = result.state == null || result.state === "" ? null : result.state;
      const uf = typeof state === "string" ? state.trim().toUpperCase() : null;
      if ((city !== null && (typeof city !== "string" || !city.trim() || city.trim().length > 120)) ||
          (state !== null && (typeof state !== "string" ||
            !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(uf)))) {
        throw new ProviderError("invalid_provider_response", 502, "O provedor retornou uma localidade inválida.");
      }
      return {
        latitude, longitude,
        city: city === null ? null : city.trim(),
        state: state === null ? null : uf,
        approximate: true,
      };
    },
  });
}
