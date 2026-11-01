const SANDBOX_ORIGIN = "https://api-sandbox.asaas.com";
const PRODUCTION_ORIGIN = "https://api.asaas.com";
const IDENTIFIER = /^[A-Za-z0-9._:-]{1,128}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{16,128}$/;

export class AsaasClientError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AsaasClientError";
    this.code = code;
  }
}

function requiredText(value, label, maximum = 200) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maximum) {
    throw new AsaasClientError("asaas_invalid_request", `${label} inválido.`);
  }
  return normalized;
}

function cpf(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!/^\d{11}$/.test(digits)) throw new AsaasClientError("asaas_invalid_request", "CPF inválido.");
  return digits;
}

function email(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new AsaasClientError("asaas_invalid_request", "E-mail inválido.");
  }
  return normalized;
}

function assertIdentifier(value, label) {
  const normalized = String(value ?? "").trim();
  if (!IDENTIFIER.test(normalized)) throw new AsaasClientError("asaas_invalid_request", `${label} inválido.`);
  return normalized;
}

function assertIdempotencyKey(value) {
  const normalized = String(value ?? "").trim();
  if (!IDEMPOTENCY_KEY.test(normalized)) {
    throw new AsaasClientError("asaas_invalid_request", "Chave de idempotência inválida.");
  }
  return normalized;
}

function amount(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AsaasClientError("asaas_invalid_request", "Valor inválido.");
  }
  return Number((value / 100).toFixed(2));
}

function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "")) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))) {
    throw new AsaasClientError("asaas_invalid_request", "Data de vencimento inválida.");
  }
  return value;
}

function assertResponseId(payload, kind) {
  if (!payload || typeof payload !== "object" || !IDENTIFIER.test(String(payload.id ?? ""))) {
    throw new AsaasClientError("asaas_invalid_response", `Resposta de ${kind} inválida.`);
  }
  return payload.id;
}

// Cliente preparatório deliberadamente restrito ao sandbox. Ele não é ligado
// ao runtime financeiro e não implementa split, escrow, estorno ou cartão.
export function createAsaasClient({
  enabled = false,
  apiKey,
  environment = "sandbox",
  baseUrl = `${environment === "production" ? PRODUCTION_ORIGIN : SANDBOX_ORIGIN}/v3`,
  fetchImpl = fetch,
  timeoutMs = 5_000,
  userAgent = "FraldaCycle-preactivation",
} = {}) {
  if (typeof enabled !== "boolean" || typeof fetchImpl !== "function"
    || !Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 15_000) {
    throw new AsaasClientError("asaas_invalid_configuration", "Configuração Asaas inválida.");
  }

  const disabled = async () => {
    throw new AsaasClientError("asaas_not_enabled", "Integração Asaas não ativada.");
  };
  if (!enabled) return Object.freeze({ createCustomer: disabled, createPixCharge: disabled, createCreditCardCharge: disabled, createCreditCardSubscription: disabled, cancelSubscription: disabled, getPayment: disabled });

  let origin;
  try { origin = new URL(baseUrl); }
  catch { throw new AsaasClientError("asaas_invalid_configuration", "Configuração Asaas inválida."); }
  const expectedOrigin = environment === "production" ? PRODUCTION_ORIGIN : SANDBOX_ORIGIN;
  if (!['sandbox','production'].includes(environment) || origin.protocol !== "https:" || origin.origin !== expectedOrigin || origin.pathname.replace(/\/$/, "") !== "/v3"
    || !String(apiKey ?? "").trim() || !String(userAgent ?? "").trim()) {
    throw new AsaasClientError("asaas_invalid_configuration", "Somente o sandbox Asaas homologado pode ser configurado.");
  }

  async function request(method, path, { body, idempotencyKey } = {}) {
    const headers = Object.freeze({
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": userAgent,
      access_token: apiKey,
      ...(idempotencyKey ? { "idempotency-key": assertIdempotencyKey(idempotencyKey) } : {}),
    });
    let response;
    try {
      response = await fetchImpl(`${origin.origin}/v3${path}`, {
        method, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new AsaasClientError("asaas_unavailable", "Asaas indisponível; concilie pela referência antes de repetir.");
    }
    if (!response?.ok) {
      throw new AsaasClientError("asaas_rejected", `Asaas recusou a solicitação (${Number(response?.status) || 0}).`);
    }
    try { return await response.json(); }
    catch { throw new AsaasClientError("asaas_invalid_response", "Resposta Asaas inválida."); }
  }

  return Object.freeze({
    async createCustomer({ reference, name, billingCpf, billingEmail, idempotencyKey }) {
      const payload = {
        name: requiredText(name, "Nome"),
        cpfCnpj: cpf(billingCpf),
        email: email(billingEmail),
        externalReference: assertIdentifier(reference, "Referência"),
      };
      const result = await request("POST", "/customers", { body: payload, idempotencyKey });
      return Object.freeze({ provider: "asaas", customerId: assertResponseId(result, "cliente"), reference: payload.externalReference });
    },

    async createPixCharge({ customerId, reference, amountCents, dueDate, description, idempotencyKey }) {
      const payload = {
        customer: assertIdentifier(customerId, "Cliente"),
        billingType: "PIX",
        value: amount(amountCents),
        dueDate: date(dueDate),
        description: requiredText(description, "Descrição", 500),
        externalReference: assertIdentifier(reference, "Referência"),
      };
      const result = await request("POST", "/payments", { body: payload, idempotencyKey });
      return Object.freeze({ provider: "asaas", paymentId: assertResponseId(result, "cobrança"), reference: payload.externalReference });
    },

    async createCreditCardCharge({ customerId, reference, amountCents, dueDate, description, creditCardToken, idempotencyKey }) {
      const payload = {
        customer: assertIdentifier(customerId, "Cliente"), billingType: "CREDIT_CARD",
        value: amount(amountCents), dueDate: date(dueDate),
        description: requiredText(description, "Descrição", 500),
        creditCardToken: requiredText(creditCardToken, "Token do cartão", 512),
        externalReference: assertIdentifier(reference, "Referência"),
      };
      const result = await request("POST", "/payments", { body: payload, idempotencyKey });
      return Object.freeze({ provider: "asaas", paymentId: assertResponseId(result, "cobrança"), reference: payload.externalReference });
    },

    async createCreditCardSubscription({ customerId, reference, amountCents, nextDueDate, description, creditCardToken, idempotencyKey }) {
      const payload = {
        customer: assertIdentifier(customerId, "Cliente"), billingType: "CREDIT_CARD",
        value: amount(amountCents), nextDueDate: date(nextDueDate), cycle: "MONTHLY",
        description: requiredText(description, "Descrição", 500),
        creditCardToken: requiredText(creditCardToken, "Token do cartão", 512),
        externalReference: assertIdentifier(reference, "Referência"),
      };
      const result = await request("POST", "/subscriptions", { body: payload, idempotencyKey });
      return Object.freeze({ provider: "asaas", subscriptionId: assertResponseId(result, "assinatura"), reference: payload.externalReference, status: String(result.status ?? "PENDING") });
    },

    async cancelSubscription(subscriptionId) {
      const id = assertIdentifier(subscriptionId, "Assinatura");
      const result = await request("DELETE", `/subscriptions/${encodeURIComponent(id)}`);
      if (result?.deleted !== true && result?.id !== id) throw new AsaasClientError("asaas_invalid_response", "Resposta de cancelamento inválida.");
      return Object.freeze({ provider: "asaas", subscriptionId: id, cancelled: true });
    },

    async getPayment(paymentId) {
      const id = assertIdentifier(paymentId, "Cobrança");
      const result = await request("GET", `/payments/${encodeURIComponent(id)}`);
      const resultId = assertResponseId(result, "cobrança");
      if (resultId !== id || typeof result.status !== "string" || !result.status
        || typeof result.externalReference !== "string" || !result.externalReference) {
        throw new AsaasClientError("asaas_invalid_response", "Resposta de cobrança inválida.");
      }
      return Object.freeze({
        provider: "asaas", paymentId: resultId, status: result.status,
        reference: result.externalReference, value: Number.isFinite(result.value) ? result.value : null,
        subscriptionId: typeof result.subscription === "string" && IDENTIFIER.test(result.subscription) ? result.subscription : null,
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(result.dueDate ?? "")) ? result.dueDate : null,
      });
    },
  });
}
