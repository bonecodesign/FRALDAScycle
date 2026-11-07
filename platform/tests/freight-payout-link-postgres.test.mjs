import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../apps/api/server.js";
import { loadConfig } from "../apps/api/config.js";
import { createLogisticsService } from "../apps/api/logistics-service.js";
import { createDeliveryQuoteService } from "../apps/api/delivery-quote-service.js";
import { createDeliveryQuoteRepository } from "../database/delivery-quote-repository.js";
import { createFreightSettlementService } from "../apps/api/freight-settlement-service.js";
import { createFreightSettlementRepository } from "../database/freight-settlement-repository.js";
import { createLogisticsRepository } from "../database/logistics-repository.js";
import { createDatabase } from "../database/client.js";
import { discoverMigrations, migrate } from "../database/migrate.js";
import { nativePostgresTools, withNativeTestPostgres } from "../tools/native-postgres.mjs";

const native = await nativePostgresTools();
const ids = {
  seller: "11111111-1111-4111-8111-111111111111",
  buyer: "22222222-2222-4222-8222-222222222222",
  courier: "33333333-3333-4333-8333-333333333333",
  finance: "44444444-4444-4444-8444-444444444444",
  logistics: "55555555-5555-4555-8555-555555555555",
  listing: "66666666-6666-4666-8666-666666666666",
  transaction: "77777777-7777-4777-8777-777777777777",
  payment: "88888888-8888-4888-8888-888888888888",
  shipment: "99999999-9999-4999-8999-999999999999",
  proof: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

test("PostgreSQL links prepared seller and own-courier payouts to approved freight plan without moving money", {
  skip: !native && !process.env.CI ? "PostgreSQL nativo indisponível." : false,
  timeout: 90_000,
}, async () => {
  await withNativeTestPostgres(async databaseUrl => {
    const database = createDatabase({ databaseUrl, databaseSsl: false });
    let api;
    try {
      await migrate(database, await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name,role,staff_access_level,staff_sector)
        VALUES($1,'link-seller@example.test','fixture','Vendedor sintético','customer',NULL,NULL),
        ($2,'link-buyer@example.test','fixture','Comprador sintético','customer',NULL,NULL),
        ($3,'link-courier@example.test','fixture','Entregador sintético','courier',NULL,NULL),
        ($4,'link-finance@example.test','fixture','Financeiro sintético','admin',3,'finance'),
        ($5,'link-logistics@example.test','fixture','Logística sintética','admin',4,'logistics')`,
        [ids.seller,ids.buyer,ids.courier,ids.finance,ids.logistics]);
      await database.query("INSERT INTO courier_profiles(user_id) VALUES($1)",[ids.courier]);
      await database.query(`INSERT INTO listings(id,seller_id,title,description,category,brand,model,package_condition,size,quantity,kind,price_cents,status)
        VALUES($1,$2,'Venda com frete interno','Simulação sem cobrança ou transferência externa.','infant','Marca','Modelo','sealed','M',1,'sale',10000,'unavailable')`,
        [ids.listing,ids.seller]);
      await database.query(`INSERT INTO transactions(id,listing_id,buyer_id,seller_id,status,amount_cents)
        VALUES($1,$2,$3,$4,'payment_pending',10000)`,
        [ids.transaction,ids.listing,ids.buyer,ids.seller]);
      await database.query(`INSERT INTO shipments(id,transaction_id,buyer_id,seller_id,courier_id,mode,insured,idempotency_key,provider_reference,status)
        VALUES($1,$2,$3,$4,$5,'partner',false,'freight-link-synthetic-shipment','fixture-only','delivered')`,
        [ids.shipment,ids.transaction,ids.buyer,ids.seller,ids.courier]);
      await database.query(`INSERT INTO delivery_proofs(id,shipment_id,courier_id,media_key,recipient_name,latitude,longitude)
        VALUES($1,$2,$3,'proofs/freight-link-fixture.webp','Destinatário sintético',-19.9,-43.9)`,
        [ids.proof,ids.shipment,ids.courier]);
      await database.query('INSERT INTO delivery_receipt_approvals(proof_id,approver_id) VALUES($1,$2)',[ids.proof,ids.buyer]);
      await database.query(`INSERT INTO delivery_proof_validations(proof_id,validator_id,reason)
        VALUES($1,$2,'Aprovado apenas para teste de conciliação.')`,[ids.proof,ids.logistics]);

      const deliveryRepository = createDeliveryQuoteRepository(database);
      const delivery = createDeliveryQuoteService(deliveryRepository);
      const request = {
        originAddressId:"address-1",originAddressVersion:1,
        destinationAddressId:"address-2",destinationAddressVersion:1,
        mode:"express",listingId:ids.listing,quantity:1,packageVersion:1,
      };
      const quote = await delivery.registerCalculated(ids.transaction, {
        provider:"fraldacycle_courier",quoteId:"freight-payout-link-quote",
        baseFreightCents:2000,customerTotalCents:2100,currency:"BRL",
        expiresAt:new Date(Date.now()+120000).toISOString(),
        courierCandidates:[{courierId:ids.courier,priority:1,distanceToRecipientKm:1}],
      }, request);
      await delivery.confirm(ids.buyer,{
        quoteId:quote.id,providerQuoteId:"freight-payout-link-quote",
        customerTotalCents:2100,request,
      });
      await deliveryRepository.lockForPayment({
        transactionId:ids.transaction,paymentIntentId:"synthetic-fixture",
      });
      // The sale quote is locked before moving from checkout into delivery.
      // The test simulates the later delivery state without any external charge.
      await database.query("UPDATE transactions SET status='in_delivery' WHERE id=$1",[ids.transaction]);
      await database.query(`INSERT INTO payment_intents
        (id,transaction_id,buyer_id,idempotency_key,method,amount_cents,
         platform_fee_cents,delivery_fee_cents,seller_amount_cents,provider_reference,status)
        VALUES($1,$2,$3,'freight-link-synthetic-payment','pix',12100,900,2000,9200,
          'payment-fixture-never-sent','paid')`,[ids.payment,ids.transaction,ids.buyer]);
      const logistics = createLogisticsService(createLogisticsRepository(database),null,null);
      const actor = { id: ids.logistics, role:"admin",staffSector:"logistics",staffAccessLevel:4 };
      api = createApiServer({
        config:loadConfig({ NODE_ENV:"test", RATE_LIMIT_MAX:"1000" }),
        logisticsService:logistics,
        authService:{async session(token){return token==="logistics"?actor:null;}},
      });
      await new Promise(resolve=>api.listen(0,"127.0.0.1",resolve));
      const root=`http://127.0.0.1:${api.address().port}/v1/shipments/${ids.shipment}`;
      const prepare = category=>fetch(`${root}/${category}-payout`,{
        method:"POST",headers:{cookie:"fc_session=logistics","content-type":"application/json"},
        body:JSON.stringify({confirmed:true}),
      });

      const status = category => fetch(`${root}/${category}-payout`,{
        headers:{cookie:"fc_session=logistics"},
      });
      // The status screens must flag missing financial provenance, not promise
      // an eligible payout while a confirmed freight quote is still unlinked.
      const missingPlanSeller = await (await status("seller")).json();
      const missingPlanCourier = await (await status("courier")).json();
      assert.equal(missingPlanSeller.payout.eligible,false);
      assert.equal(missingPlanCourier.payout.eligible,false);
      assert.ok(missingPlanSeller.payout.blockers.includes("freight_plan_required"));
      assert.ok(missingPlanCourier.payout.blockers.includes("freight_plan_required"));
      // A locked quote cannot be liquidated using the legacy split without
      // an immutable plan signed off by the finance sector.
      assert.equal((await prepare("seller")).status,409);
      assert.equal((await prepare("courier")).status,409);
      assert.equal((await database.query("SELECT count(*)::int AS n FROM seller_payout_obligations")).rows[0].n,0);
      assert.equal((await database.query("SELECT count(*)::int AS n FROM courier_payout_obligations")).rows[0].n,0);
      const finance = createFreightSettlementService(createFreightSettlementRepository(database));
      const plan = await finance.prepare({
        id:ids.finance,role:"admin",staffSector:"finance",staffAccessLevel:3,
      },{quoteId:quote.id,confirmed:true});

      // Disguised financial mismatch must not produce either payout obligation.
      await database.query("UPDATE payment_intents SET amount_cents=12101,platform_fee_cents=901 WHERE id=$1",[ids.payment]);
      assert.equal((await prepare("seller")).status,409);
      assert.equal((await prepare("courier")).status,409);
      const wrongSeller = await (await status("seller")).json();
      const wrongCourier = await (await status("courier")).json();
      assert.ok(wrongSeller.payout.blockers.includes("payment_split_mismatch"));
      assert.ok(wrongCourier.payout.blockers.includes("payment_split_mismatch"));
      await database.query("UPDATE payment_intents SET amount_cents=12100,platform_fee_cents=900 WHERE id=$1",[ids.payment]);
      const readySeller = await (await status("seller")).json();
      const readyCourier = await (await status("courier")).json();
      assert.equal(readySeller.payout.eligible,true);
      assert.equal(readyCourier.payout.eligible,true);
      assert.equal(readySeller.payout.grossProductCents,10000);
      assert.equal(readySeller.payout.platformFeeCents,800);
      assert.equal(readyCourier.payout.freightCents,2100);
      assert.equal(readyCourier.payout.payoutAllowed,false);

      const seller = await prepare("seller");
      const courier = await prepare("courier");
      assert.equal(seller.status,201,JSON.stringify(await seller.clone().json()));
      assert.equal(courier.status,201,JSON.stringify(await courier.clone().json()));
      const s = (await database.query(`SELECT gross_product_cents,platform_fee_cents,
        seller_amount_cents,freight_settlement_plan_id,status,provider_reference
        FROM seller_payout_obligations WHERE shipment_id=$1`,[ids.shipment])).rows[0];
      const c = (await database.query(`SELECT freight_cents,platform_fee_cents,
        courier_amount_cents,freight_settlement_plan_id,status,provider_reference
        FROM courier_payout_obligations WHERE shipment_id=$1`,[ids.shipment])).rows[0];
      assert.deepEqual(s,{
        gross_product_cents:10000,platform_fee_cents:800,seller_amount_cents:9200,
        freight_settlement_plan_id:plan.plan.id,status:"provider_pending",provider_reference:null,
      });
      assert.deepEqual(c,{
        freight_cents:2100,platform_fee_cents:100,courier_amount_cents:2000,
        freight_settlement_plan_id:plan.plan.id,status:"provider_pending",provider_reference:null,
      });
      assert.equal(s.gross_product_cents+c.freight_cents,12100);
      assert.equal(s.platform_fee_cents+c.platform_fee_cents,900);
      assert.equal((await prepare("seller")).status,200);
      assert.equal((await prepare("courier")).status,200);
      assert.equal((await database.query(`SELECT count(*)::int AS n FROM audit_events
        WHERE action IN ('seller.payout.prepared','courier.payout.prepared')`)).rows[0].n,2);
    } finally {
      if(api?.listening)await new Promise(resolve=>api.close(resolve));
      await database.close();
    }
  });
});
