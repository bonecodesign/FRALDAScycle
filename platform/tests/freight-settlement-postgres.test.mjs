import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../apps/api/server.js";
import { loadConfig } from "../apps/api/config.js";
import { createDeliveryQuoteService } from "../apps/api/delivery-quote-service.js";
import { createDeliveryQuoteRepository } from "../database/delivery-quote-repository.js";
import { createFreightSettlementService } from "../apps/api/freight-settlement-service.js";
import { createFreightSettlementRepository } from "../database/freight-settlement-repository.js";
import { createDatabase } from "../database/client.js";
import { discoverMigrations, migrate } from "../database/migrate.js";
import { nativePostgresTools, withNativeTestPostgres } from "../tools/native-postgres.mjs";

const native = await nativePostgresTools();
const ids = {
  seller: "11111111-1111-4111-8111-111111111111",
  buyer: "22222222-2222-4222-8222-222222222222",
  finance: "33333333-3333-4333-8333-333333333333",
  outsider: "44444444-4444-4444-8444-444444444444",
  operations: "55555555-5555-4555-8555-555555555555",
  listing: "66666666-6666-4666-8666-666666666666",
  transaction: "77777777-7777-4777-8777-777777777777",
  payment: "88888888-8888-4888-8888-888888888888",
};
const request = {
  originAddressId: "origin-fixture", originAddressVersion: 1,
  destinationAddressId: "destination-fixture", destinationAddressVersion: 1,
  mode: "partner", listingId: ids.listing, quantity: 1, packageVersion: 1,
};

test("finance prepares freight obligation once and reconciles local split, mismatches and disputes without payout", {
  skip: !native && !process.env.CI ? "PostgreSQL local indisponível." : false,
  timeout: 90_000,
}, async () => {
  await withNativeTestPostgres(async databaseUrl => {
    const db = createDatabase({ databaseUrl, databaseSsl: false });
    let api;
    try {
      await migrate(db, await discoverMigrations());
      await db.query(`INSERT INTO users(id,email,password_hash,display_name,role,staff_access_level,staff_sector)
        VALUES ($1,'freight-seller@example.test','fixture','Vendedor','customer',NULL,NULL),
        ($2,'freight-buyer@example.test','fixture','Comprador','customer',NULL,NULL),
        ($3,'freight-finance@example.test','fixture','Financeiro','admin',3,'finance'),
        ($4,'freight-outsider@example.test','fixture','Externo','customer',NULL,NULL),
        ($5,'freight-ops@example.test','fixture','Operações','admin',4,'operations')`,
      [ids.seller, ids.buyer, ids.finance, ids.outsider, ids.operations]);
      await db.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,quantity,kind,price_cents,status)
        VALUES($1,$2,'Venda com frete confirmado','Fixture para preparação financeira.','infant','Marca','Modelo','sealed',1,'sale',10000,'unavailable')`,
      [ids.listing, ids.seller]);
      await db.query(`INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents)
        VALUES($1,$2,$3,$4,'payment_pending',10000)`, [ids.transaction,ids.listing,ids.buyer,ids.seller]);

      const deliveryRepository = createDeliveryQuoteRepository(db);
      const delivery = createDeliveryQuoteService(deliveryRepository);
      const quote = await delivery.registerCalculated(ids.transaction, {
        provider: "lalamove", quoteId: "freight-plan-synthetic-quote",
        baseFreightCents: 2000, customerTotalCents: 2100, currency: "BRL",
        expiresAt: new Date(Date.now() + 120000).toISOString(),
      }, request);
      await delivery.confirm(ids.buyer, {
        quoteId: quote.id, providerQuoteId: "freight-plan-synthetic-quote",
        customerTotalCents: 2100, request,
      });

      const service = createFreightSettlementService(createFreightSettlementRepository(db));
      const actors = {
        finance: { id: ids.finance, role: "admin", staffAccessLevel: 3, staffSector: "finance" },
        operations: { id: ids.operations, role: "admin", staffAccessLevel: 4, staffSector: "operations" },
        outsider: { id: ids.outsider, role: "customer" },
      };
      api = createApiServer({
        config: loadConfig({ NODE_ENV: "test", RATE_LIMIT_MAX: "1000" }),
        freightSettlementService: service,
        authService: { async session(token) { return actors[token] ?? null; } },
      });
      await new Promise(resolve => api.listen(0, "127.0.0.1", resolve));
      const root = `http://127.0.0.1:${api.address().port}/v1/admin/freight-settlement-plans`;
      const headers = token => ({ cookie: `fc_session=${token}`, "content-type": "application/json" });
      const submit = token => fetch(root, {
        method: "POST", headers: headers(token),
        body: JSON.stringify({ quoteId: quote.id, confirmed: true }),
      });
      assert.equal((await submit("outsider")).status, 403);
      assert.equal((await submit("operations")).status, 403);
      const [first, second] = await Promise.all([submit("finance"), submit("finance")]);
      assert.deepEqual([first.status,second.status].sort(),[200,201]);
      const result = first.status===201?await first.json():await second.json();
      assert.equal(result.plan.providerAmountCents, 2000);
      assert.equal(result.plan.platformFeeCents, 100);
      assert.equal(result.plan.customerTotalCents, 2100);
      assert.equal(result.plan.executionAllowed, false);
      assert.equal(result.plan.externalChargeCreated, false);
      assert.equal((await db.query("SELECT count(*)::int AS n FROM freight_settlement_plans")).rows[0].n, 1);
      assert.equal((await db.query(
        "SELECT count(*)::int AS n FROM audit_events WHERE action='freight.settlement.plan.prepared'",
      )).rows[0].n, 1);
      const planId = result.plan.id;
      const review = token => fetch(`${root}/${planId}/reconciliation`, { headers: headers(token) });
      assert.equal((await review("operations")).status, 403);
      const pending = await review("finance");
      assert.equal(pending.status, 200);
      assert.equal(pending.headers.get("cache-control"), "no-store");
      const pendingBody = await pending.json();
      assert.equal(pendingBody.reconciliation.localMatched, false);
      assert.ok(pendingBody.reconciliation.blockers.includes("payment_not_confirmed"));
      assert.equal(pendingBody.reconciliation.payoutAllowed, false);

      await deliveryRepository.lockForPayment({
        transactionId: ids.transaction, paymentIntentId: "synthetic-only",
      });
      await db.query(`INSERT INTO payment_intents
        (id,transaction_id,buyer_id,idempotency_key,method,amount_cents,
         platform_fee_cents,delivery_fee_cents,seller_amount_cents,provider_reference,status)
        VALUES($1,$2,$3,'freight-plan-paid-fixture','pix',12100,900,2000,9200,
          'fake-reference-never-sent','paid')`, [ids.payment, ids.transaction, ids.buyer]);
      const approvedLocally = await (await review("finance")).json();
      assert.equal(approvedLocally.reconciliation.localMatched, true);
      assert.equal(approvedLocally.reconciliation.providerReconciled, false);
      assert.equal(approvedLocally.reconciliation.payoutAllowed, false);
      assert.deepEqual(approvedLocally.reconciliation.blockers, ["external_reconciliation_not_homologated"]);

      await db.query(`UPDATE payment_intents SET amount_cents=12101,
        platform_fee_cents=901 WHERE id=$1`, [ids.payment]);
      const wrong = await (await review("finance")).json();
      assert.equal(wrong.reconciliation.localMatched, false);
      assert.ok(wrong.reconciliation.blockers.includes("payment_split_mismatch"));
      await db.query("UPDATE payment_intents SET amount_cents=12100,platform_fee_cents=900 WHERE id=$1",
        [ids.payment]);

      await db.query(`INSERT INTO payment_cases
        (payment_intent_id,requester_id,kind,idempotency_key,reason,details)
        VALUES($1,$2,'dispute','freight-plan-test-dispute','problema','Revisão sintética de pagamento e entrega.')`,
        [ids.payment,ids.buyer]);
      const check=await fetch(`${root}/${planId}/reconciliation/check`,{
        method:"POST",headers:headers("finance"),body:JSON.stringify({confirmed:true}),
      });
      assert.equal(check.status,200);
      assert.ok((await check.json()).incidents.some(x=>x.code==="financial_case_pending"));
      const operationalId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      await db.query(`INSERT INTO operational_incidents
        (id,reference,idempotency_key,title,summary,severity,domain,created_by)
        VALUES($1,'FIN-FREIGHT-TEST',$2,'Divergência financeira de frete',
          'Encaminhamento de divergência local fictícia para acompanhamento humano.',
          'medium','payments',$3)`,[operationalId,"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",ids.operations]);
      const supervisionUrl=`${root}/${planId}/supervision`;
      const link=token=>fetch(supervisionUrl,{
        method:"POST",headers:headers(token),
        body:JSON.stringify({incidentId:operationalId,confirmed:true}),
      });
      assert.equal((await link("operations")).status,403);
      assert.equal((await link("finance")).status,201);
      assert.equal((await link("finance")).status,201);
      const linked=await (await fetch(supervisionUrl,{headers:headers("finance")})).json();
      assert.equal(linked.supervision.incident_id,operationalId);
      assert.equal((await db.query("SELECT count(*)::int AS n FROM freight_incident_supervision")).rows[0].n,1);
      assert.equal((await db.query(`SELECT count(*)::int AS n FROM audit_events
        WHERE action='freight.reconciliation.supervision.linked'`)).rows[0].n,1);
      const disputed = await (await review("finance")).json();
      assert.equal(disputed.reconciliation.localMatched, false);
      assert.ok(disputed.reconciliation.blockers.includes("financial_case_pending"));
      assert.equal((await db.query(
        "SELECT count(*)::int AS n FROM courier_payout_obligations")).rows[0].n, 0);
      assert.equal((await db.query(
        "SELECT count(*)::int AS n FROM seller_payout_obligations")).rows[0].n, 0);
    } finally {
      if (api?.listening) await new Promise(resolve => api.close(resolve));
      await db.close();
    }
  });
});

test("exchange legs produce independent non-executing plans for their own confirmed payers", {
  skip: !native && !process.env.CI ? "PostgreSQL local indisponível." : false,
  timeout: 90_000,
}, async () => {
  await withNativeTestPostgres(async databaseUrl => {
    const db = createDatabase({ databaseUrl, databaseSsl: false });
    try {
      await migrate(db,await discoverMigrations());
      await db.query(`INSERT INTO users(id,email,password_hash,display_name)
        VALUES($1,'leg-owner@example.test','fixture','Proprietário'),
              ($2,'leg-requester@example.test','fixture','Solicitante'),
              ($3,'leg-finance@example.test','fixture','Financeiro')`,
        [ids.seller,ids.buyer,ids.finance]);
      await db.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,quantity,kind,status)
        VALUES($1,$2,'Troca bilateral sintética','Duas pernas independentes de entrega.','infant','Marca','Modelo','sealed',1,'exchange','unavailable')`,
        [ids.listing,ids.seller]);
      await db.query(`INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status)
        VALUES($1,$2,$3,$4,'in_delivery')`,[ids.transaction,ids.listing,ids.buyer,ids.seller]);
      const legs = ["99999999-9999-4999-8999-999999999991","99999999-9999-4999-8999-999999999992"];
      await db.query(`INSERT INTO shipments(id,transaction_id,buyer_id,seller_id,mode,insured,idempotency_key,status,exchange_leg,logistics_payer_id)
        VALUES($1,$3,$4,$5,'partner',false,'settlement-leg-one','awaiting_pickup',1,$4),
              ($2,$3,$5,$4,'partner',false,'settlement-leg-two','awaiting_pickup',2,$5)`,
        [legs[0],legs[1],ids.transaction,ids.seller,ids.buyer]);
      const delivery = createDeliveryQuoteService(createDeliveryQuoteRepository(db));
      const settlement = createFreightSettlementService(createFreightSettlementRepository(db));
      const finance = { id: ids.finance, role: "admin", staffSector: "finance", staffAccessLevel: 3 };
      const plans = [];
      for(let index=0;index<2;index++){
        const request = {
          originAddressId: `origin-${index}`,originAddressVersion:1,
          destinationAddressId: `destination-${index}`,destinationAddressVersion:1,
          mode:"partner",listingId:ids.listing,quantity:1,packageVersion:1,
        };
        const payer=index===0?ids.seller:ids.buyer;
        const quote=await delivery.registerCalculatedForShipment(ids.transaction,legs[index],{
          provider:"lalamove",quoteId:`exchange-settlement-leg-${index}`,
          baseFreightCents:index===0?2000:3000,
          customerTotalCents:index===0?2100:3150,currency:"BRL",
          expiresAt:new Date(Date.now()+120000).toISOString(),
        },request);
        await assert.rejects(settlement.prepare(finance,{quoteId:quote.id,confirmed:true}),
          e=>e.code==="freight_quote_not_confirmed");
        await delivery.confirm(payer,{
          quoteId:quote.id,providerQuoteId:`exchange-settlement-leg-${index}`,
          customerTotalCents:index===0?2100:3150,request,
        });
        const prepared=await settlement.prepare(finance,{quoteId:quote.id,confirmed:true});
        assert.equal(prepared.plan.shipmentId,legs[index]);
        assert.equal(prepared.plan.customerTotalCents,index===0?2100:3150);
        plans.push(prepared.plan.id);
      }
      assert.notEqual(plans[0],plans[1]);
      const first=await settlement.reconcileLocal(finance,plans[0]);
      const second=await settlement.reconcileLocal(finance,plans[1]);
      for(const value of [first,second]){
        assert.equal(value.reconciliation.payoutAllowed,false);
        assert.ok(value.reconciliation.blockers.includes("exchange_leg_payment_not_configured"));
      }
      assert.equal((await db.query("SELECT count(*)::int AS n FROM freight_settlement_plans")).rows[0].n,2);
    } finally {
      await db.close();
    }
  });
});
