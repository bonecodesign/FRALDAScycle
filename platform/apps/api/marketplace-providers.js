import { ServiceError } from "./service-error.js";
export class ProviderError extends ServiceError {
  constructor(code, status, message) {
    super(code, status, message);
  }
}

function configured(endpoint, secret, name) {
  if (!endpoint || !secret) {
    throw new ProviderError("provider_not_configured", 503, `${name} ainda não foi configurado.`);
  }
}

function httpsUrl(value, field) {
  let url;
  try { url = new URL(value); } catch { throw new ProviderError("invalid_provider_response", 502, `Resposta inválida do provedor: ${field}.`); }
  if (url.protocol !== "https:") throw new ProviderError("invalid_provider_response", 502, `O provedor deve retornar HTTPS em ${field}.`);
  return url.toString();
}

async function providerRequest(endpoint, secret, payload, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new ProviderError("provider_unavailable", 503, "Integração externa temporariamente indisponível.");
  }
  if (!response.ok) throw new ProviderError("provider_rejected", 502, "O provedor externo recusou a solicitação.");
  try { return await response.json(); } catch {
    throw new ProviderError("invalid_provider_response", 502, "O provedor retornou uma resposta inválida.");
  }
}

export function createMarketplaceProviders(config, fetchImpl = fetch) {
  return Object.freeze({
    async signedProofRead(userId, storageKey) {
      configured(config.mediaProviderUrl, config.mediaProviderSecret, "O armazenamento de mídia");
      if (!/^[a-zA-Z0-9/_-]{8,512}$/.test(storageKey)) {
        throw new ProviderError("invalid_proof_media", 422, "Chave do comprovante inválida.");
      }
      const result = await providerRequest(config.mediaProviderUrl, config.mediaProviderSecret, {
        operation: "signed-read", requesterId: userId, storageKey, expiresInSeconds: 300,
      }, fetchImpl);
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
      const contentType = String(input?.contentType ?? "");
      const sizeBytes = Number(input?.sizeBytes);
      if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
        throw new ProviderError("invalid_media_type", 422, "Envie uma imagem JPEG, PNG ou WebP.");
      }
      if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 10_000_000) {
        throw new ProviderError("invalid_media_size", 422, "A imagem deve ter no máximo 10 MB.");
      }
      const result = await providerRequest(config.mediaProviderUrl, config.mediaProviderSecret, {
        operation: "signed-upload", ownerId: userId, contentType, sizeBytes,
      }, fetchImpl);
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
      const address = String(input?.address ?? "").trim();
      if (address.length < 5 || address.length > 300) {
        throw new ProviderError("invalid_address", 422, "Informe um endereço válido.");
      }
      const result = await providerRequest(config.geocodingProviderUrl, config.geocodingProviderSecret, {
        operation: "geocode", requesterId: userId, address, country: "BR",
      }, fetchImpl);
      const latitude = Number(result.latitude);
      const longitude = Number(result.longitude);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
          !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        throw new ProviderError("invalid_provider_response", 502, "O provedor retornou coordenadas inválidas.");
      }
      return {
        latitude, longitude,
        city: String(result.city ?? "").slice(0, 120) || null,
        state: String(result.state ?? "").slice(0, 2).toUpperCase() || null,
        approximate: true,
      };
    },
  });
}
