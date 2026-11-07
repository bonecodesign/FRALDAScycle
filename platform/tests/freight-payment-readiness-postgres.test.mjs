import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../apps/api/server.js";
import { loadConfig } from "../apps/api/config.js";
import { createDeliveryQuoteService } from "../apps/api/delivery-quote-service.js";
import { createPaymentService } from "../apps/api/payment-service.js";
import { createDeliveryQuoteRepository } from "../database/delivery-quote-repository.js";
import { createPaymentRepository } from "../database/payment-repository.js";
import { createDatabase } from "../database/client.js";
import { discoverMigrations, migrate } from "../database/migrate.js";
import { nativePostgresTools, withNativeTestPostgres } from "../tools/native-postgres.mjs";

const native = await nativePostgresTools();
const ids = {
  seller: "11111111-1111-4111-8111-111111111111",
  buyer: "22222222-2222-4222-8222-222222222222",
  stranger: "33333333-3333-4333-8333-333333333333",
  listing: "44444444-4444-4444-8444-444444444444",
  saleWithQuote: "55555555-5555-4555-8555-555555555555",
  saleWithIntent: "66666666-6666-4666-8666-666666666666",
};
const request = {
  originAddressId: "origin-test", originAddressVersion: 1,
  destinationAddressId: "destination-test", destinationAddressVersion: 1,
  mode: "partner", listingId: ids.listing, quantity: 1, packageVersion: 1,
};

test("sale checkout prepares confirmed freight totals but refuses provider payment and forged delivery bypass", {
  skip: !native && !process.env.CI ? "PostgreSQL temporário indisponível." : false,
  timeout: 90_000,
}, async () => {
  await withNativeTestPostgres(async databaseUrl => {
    const database = createDatabase({ databaseUrl, databaseSsl: false });
    let api;
    try {
      await migrate(database, await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name)
        VALUES($1,'preview-seller@example.test','fixture','Vendedor fictício'),
        ($2,'preview-buyer@example.test','fixture','Comprador fictício'),
        ($3,'preview-stranger@example.test','fixture','Outra pessoa fictícia')`,
        [ids.seller, ids.buyer, ids.stranger]);
      await database.query(`INSERT INTO listings
        (id,seller_id,title,description,category,brand,model,package_condition,quantity,kind,price_cents,status)
        VALUES($1,$2,'Anúncio sintético com frete','Pagamento e entrega sem integração externa.','infant',
        'Marca','Modelo','sealed',1,'sale',10000,'unavailable')`, [ids.listing, ids.seller]);
      await database.query(`INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents)
        VALUES($1,$3,$4,$5,'payment_pending',10000),
              ($2,$3,$4,$5,'payment_pending',10000)`,
        [ids.saleWithQuote, ids.saleWithIntent, ids.listing, ids.buyer, ids.seller]);

      const deliveryRepository = createDeliveryQuoteRepository(database);
      const deliveryService = createDeliveryQuoteService(deliveryRepository);
      const quote = await deliveryService.registerCalculated(ids.saleWithQuote, {
        provider: "lalamove", quoteId: "synthetic-delivery-quote-for-payment-readiness",
        baseFreightCents: 2000, customerTotalCents: 2100,
        currency: "BRL", expiresAt: new Date(Date.now() + 120000).toISOString(),
      }, request);
      const confirmed = await deliveryService.confirm(ids.buyer, {
        quoteId: quote.id, providerQuoteId: "synthetic-delivery-quote-for-payment-readiness",
        customerTotalCents: 2100, request,
      });
      assert.equal(confirmed.quote.status, "confirmed");
      let providerCalls = 0;
      const paymentService = createPaymentService(createPaymentRepository(database), {
        async createIntent() { providerCalls++; throw new Error("External provider must never be called."); },
      });
      api = createApiServer({
        config: loadConfig({ NODE_ENV: "test", RATE_LIMIT_MAX: "1000" }),
        authService: { async session(token) {
          if (token === "buyer") return { id: ids.buyer, role: "customer" };
          if (token === "stranger") return { id: ids.stranger, role: "customer" };
          return null;
        } },
        paymentService,
        deliveryQuoteService: deliveryService,
      });
      await new Promise(resolve => api.listen(0, "127.0.0.1", resolve));
      const root = `http://127.0.0.1:${api.address().port}`;
      const headers = token => ({ cookie: `fc_session=${token}`, "content-type": "application/json" });
      const url = `${root}/v1/transactions/${ids.saleWithQuote}/payment-breakdown`;
      assert.equal((await fetch(url)).status, 401);
      assert.equal((await fetch(url, { headers: headers("stranger") })).status, 404);
      const preview = await fetch(url, { headers: headers("buyer") });
      assert.equal(preview.status, 200);
      assert.equal(preview.headers.get("cache-control"), "no-store");
      const breakdown = await preview.json();
      assert.equal(breakdown.totalCents, 12100);
      assert.deepEqual(breakdown.product, { amountCents: 10000, platformFeeCents: 800, sellerCents: 9200 });
      assert.equal(breakdown.freight.partnerOrCourierCents, 2000);
      assert.equal(breakdown.freight.platformFeeCents, 100);
      assert.equal(breakdown.freightCheckoutBlocked, true);
      assert.equal(breakdown.externalChargeCreated, false);

      const intent = await fetch(`${root}/v1/payments/intents`, {
        method: "POST", headers: headers("buyer"),
        body: JSON.stringify({
          transactionId: ids.saleWithQuote, idempotencyKey: "no-delivery-request-0001",
          method: "pix", deliveryRequested: false,
        }),
      });
      const refused = await intent.json();
      assert.equal(intent.status, 503, JSON.stringify(refused));
      assert.equal(refused.error.code, "settlement_not_configured");
      assert.equal(providerCalls, 0);
      assert.equal((await database.query(
        "SELECT count(*)::int AS count FROM payment_intents WHERE transaction_id=$1",
        [ids.saleWithQuote])).rows[0].count, 0);

      // A product-only payment attempt already started must prevent a new
      // delivery quote from changing the transaction's financial obligations.
      await database.query(`INSERT INTO payment_intents
        (transaction_id,buyer_id,idempotency_key,method,amount_cents,
         platform_fee_cents,delivery_fee_cents,seller_amount_cents)
        VALUES($1,$2,'synthetic-product-only-intent','pix',10000,800,0,9200)`,
        [ids.saleWithIntent, ids.buyer]);
      await assert.rejects(deliveryService.registerCalculated(ids.saleWithIntent, {
        provider: "loggi_express", quoteId: "blocked-quote-after-payment-intent",
        baseFreightCents: 2000, customerTotalCents: 2100,
        currency: "BRL", expiresAt: new Date(Date.now() + 120000).toISOString(),
      }, request), error => error.code === "paid_transaction_locked");
      assert.equal((await database.query(
        "SELECT count(*)::int AS count FROM delivery_quotes WHERE transaction_id=$1",
        [ids.saleWithIntent])).rows[0].count, 0);
    } finally {
      if (api?.listening) await new Promise(resolve => api.close(resolve));
      await database.close();
    }
  });
});
