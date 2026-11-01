import assert from "node:assert/strict";
import test from "node:test";
import { AsaasClientError, createAsaasClient } from "../apps/api/asaas-client.js";

test("Asaas remains disabled by default and never reaches the network", async () => {
  let calls = 0;
  const client = createAsaasClient({ fetchImpl: async () => { calls++; } });
  await assert.rejects(client.createPixCharge({}), error => error instanceof AsaasClientError && error.code === "asaas_not_enabled");
  assert.equal(calls, 0);
});

test("Asaas preactivation accepts only the fixed sandbox origin", () => {
  for (const baseUrl of ["http://api-sandbox.asaas.com/v3", "https://api.asaas.com/v3", "https://example.com/v3"]) {
    assert.throws(() => createAsaasClient({ enabled: true, apiKey: "sandbox-key", baseUrl }), /sandbox Asaas/);
  }
});

test("Asaas creates sandbox customer and PIX charge with exact allowlisted payloads", async () => {
  const calls = [];
  const client = createAsaasClient({
    enabled: true, apiKey: "sandbox-secret", timeoutMs: 1_000,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      const id = url.endsWith("/customers") ? "cus_123" : "pay_123";
      return new Response(JSON.stringify({ id }), { status: 200 });
    },
  });
  const customer = await client.createCustomer({
    reference: "account-00000001", name: " Ana Silva ", billingCpf: "123.456.789-00",
    billingEmail: "ANA@EXAMPLE.COM", idempotencyKey: "customer-00000001",
  });
  const payment = await client.createPixCharge({
    customerId: customer.customerId, reference: "intent-0000000001", amountCents: 1234,
    dueDate: "2030-01-02", description: "Pedido FraldaCycle", idempotencyKey: "payment-00000001",
  });
  assert.deepEqual(customer, { provider: "asaas", customerId: "cus_123", reference: "account-00000001" });
  assert.deepEqual(payment, { provider: "asaas", paymentId: "pay_123", reference: "intent-0000000001" });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://api-sandbox.asaas.com/v3/customers");
  assert.equal(calls[0].options.headers.access_token, "sandbox-secret");
  assert.equal(calls[0].options.headers["idempotency-key"], "customer-00000001");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    name: "Ana Silva", cpfCnpj: "12345678900", email: "ana@example.com", externalReference: "account-00000001",
  });
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    customer: "cus_123", billingType: "PIX", value: 12.34, dueDate: "2030-01-02",
    description: "Pedido FraldaCycle", externalReference: "intent-0000000001",
  });
  assert.doesNotMatch(calls.map(call => call.options.body).join(" "), /card|cvv|securityCode|password/i);
});

test("Asaas payment lookup returns only reconciliation fields", async () => {
  const client = createAsaasClient({ enabled: true, apiKey: "sandbox-secret", fetchImpl: async (url, options) => {
    assert.equal(url, "https://api-sandbox.asaas.com/v3/payments/pay_123");
    assert.equal(options.method, "GET");
    return new Response(JSON.stringify({ id: "pay_123", status: "RECEIVED", externalReference: "intent-1", value: 20, customer: "secret" }));
  } });
  assert.deepEqual(await client.getPayment("pay_123"), {
    provider: "asaas", paymentId: "pay_123", status: "RECEIVED", reference: "intent-1", value: 20,
    subscriptionId: null, dueDate: null,
  });
});

test("Asaas creates a monthly tokenized subscription without raw card data",async()=>{
  let body;
  const client=createAsaasClient({enabled:true,apiKey:"sandbox-secret",fetchImpl:async(url,options)=>{
    assert.equal(url,"https://api-sandbox.asaas.com/v3/subscriptions");body=JSON.parse(options.body);
    return new Response(JSON.stringify({id:"sub_123",status:"PENDING"}),{status:200});
  }});
  const result=await client.createCreditCardSubscription({customerId:"cus_123",reference:"premium:reference-1",amountCents:1490,nextDueDate:"2030-01-02",description:"FraldaCycle Premium mensal",creditCardToken:"tokenized-card-123",idempotencyKey:"subscription-key-0001"});
  assert.deepEqual(result,{provider:"asaas",subscriptionId:"sub_123",reference:"premium:reference-1",status:"PENDING"});
  assert.deepEqual(body,{customer:"cus_123",billingType:"CREDIT_CARD",value:14.9,nextDueDate:"2030-01-02",cycle:"MONTHLY",description:"FraldaCycle Premium mensal",creditCardToken:"tokenized-card-123",externalReference:"premium:reference-1"});
  assert.equal(Object.hasOwn(body,'cardNumber'),false);assert.equal(Object.hasOwn(body,'cvv'),false);
});

test("Asaas prepares a one-time tokenized credit charge without raw card data",async()=>{
 let body;const client=createAsaasClient({enabled:true,apiKey:"sandbox-secret",fetchImpl:async(url,options)=>{assert.equal(url,"https://api-sandbox.asaas.com/v3/payments");body=JSON.parse(options.body);return new Response(JSON.stringify({id:"pay_credit_123"}),{status:200});}});
 const result=await client.createCreditCardCharge({customerId:"cus_123",reference:"exchange-difference-1",amountCents:2000,dueDate:"2030-01-02",description:"Diferença da troca",creditCardToken:"tokenized-card-123",idempotencyKey:"exchange-difference-credit-1"});assert.deepEqual(result,{provider:"asaas",paymentId:"pay_credit_123",reference:"exchange-difference-1"});assert.deepEqual(body,{customer:"cus_123",billingType:"CREDIT_CARD",value:20,dueDate:"2030-01-02",description:"Diferença da troca",creditCardToken:"tokenized-card-123",externalReference:"exchange-difference-1"});assert.equal(Object.hasOwn(body,'cardNumber'),false);assert.equal(Object.hasOwn(body,'cvv'),false);
});

test("Asaas failures are sanitized and timeout outcome requires reconciliation", async () => {
  const rejected = createAsaasClient({ enabled: true, apiKey: "sandbox-secret", fetchImpl: async () =>
    new Response(JSON.stringify({ errors: [{ description: "provider-sensitive-detail" }] }), { status: 422 }) });
  await assert.rejects(rejected.getPayment("pay_123"), error =>
    error.code === "asaas_rejected" && !error.message.includes("provider-sensitive-detail"));

  const unavailable = createAsaasClient({ enabled: true, apiKey: "sandbox-secret", fetchImpl: async () => {
    throw new Error("sandbox-secret must never escape");
  } });
  await assert.rejects(unavailable.getPayment("pay_123"), error =>
    error.code === "asaas_unavailable" && /concilie pela referência/.test(error.message) && !error.message.includes("sandbox-secret"));
});
