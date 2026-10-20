import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createLalamoveClient } from "../apps/api/lalamove-client.js";

const stops = [
  { address: "A, Belo Horizonte", coordinates: { lat: -19.9, lng: -43.9 } },
  { address: "B, Belo Horizonte", coordinates: { lat: -19.8, lng: -43.8 } },
];
const quotation = { quotationId: "quote-1", expiresAt: "2030-01-01T00:05:00Z", stops: [{ stopId: "a" }, { stopId: "b" }] };

test("Lalamove signs exact body and requests proof of delivery", async () => {
  const calls = [];
  const client = createLalamoveClient({ key: "pk_test_key", secret: "sk_test_secret", now: () => Date.parse("2030-01-01T00:00:00Z"),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      const data = url.endsWith("/quotations") ? quotation : { orderId: "order-1" };
      return new Response(JSON.stringify({ data }), { status: 201 });
    },
  });
  const quote = await client.quote({ stops });
  const order = await client.placeOrder({ quotation: quote, sender: { name: "Ana", phone: "+5531999999999" }, recipient: { name: "Bia", phone: "+5531888888888" } });
  assert.equal(order.orderId, "order-1");
  assert.equal(calls.length, 2);
  for (const { url, options } of calls) {
    assert.ok(url.startsWith("https://rest.sandbox.lalamove.com/v3/"));
    assert.equal(options.headers.market, "BR");
    const path = new URL(url).pathname;
    const expected = createHmac("sha256", "sk_test_secret")
      .update(`${Date.parse("2030-01-01T00:00:00Z")}\r\nPOST\r\n${path}\r\n\r\n${options.body}`).digest("hex");
    assert.equal(options.headers.authorization, `hmac pk_test_key:${Date.parse("2030-01-01T00:00:00Z")}:${expected}`);
  }
  assert.equal(JSON.parse(calls[1].options.body).data.isPODEnabled, true);
});

test("Lalamove refuses missing addresses and expired quotes before network request", async () => {
  let calls = 0;
  const client = createLalamoveClient({ key: "key", secret: "secret", now: () => Date.parse("2030-01-02T00:00:00Z"),
    fetchImpl: async () => { calls++; throw new Error("unexpected"); },
  });
  await assert.rejects(client.quote({ stops: [stops[0]] }), /Two geocoded stops/);
  await assert.rejects(client.placeOrder({ quotation, sender: { name: "Ana", phone: "1" }, recipient: { name: "Bia", phone: "2" } }), /unexpired quotation/);
  assert.equal(calls, 0);
});
