import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../apps/api/config.js";
import { createAuthService } from "../apps/api/auth-service.js";
import { createMarketplaceService } from "../apps/api/marketplace-service.js";
import { createLogisticsService } from "../apps/api/logistics-service.js";
import { createInstitutionService } from "../apps/api/institution-service.js";
import { createMarketplaceRepository } from "../database/marketplace-repository.js";
import { createExchangeRepository } from "../database/exchange-repository.js";
import { createDonationRepository } from "../database/donation-repository.js";
import { createLogisticsRepository } from "../database/logistics-repository.js";
import { pilotBhConfig, pilotBhLocation, pilotBhPostalCode } from "../apps/api/pilot-bh.js";

const pilot = pilotBhConfig({ PILOT_BH_ENABLED: "true", PILOT_BH_INVITED_EMAILS: "ana@example.test,admin@example.test" });
const userId = "11111111-1111-4111-8111-111111111111";

test("BH pilot stays disabled by default and rejects an empty or duplicate invitation list", () => {
  assert.equal(loadConfig({ NODE_ENV: "test" }).pilotBh.enabled, false);
  assert.throws(() => loadConfig({ PILOT_BH_ENABLED: "true" }), /PILOT_BH_INVITED_EMAILS/);
  assert.throws(() => loadConfig({ PILOT_BH_ENABLED: "TRUE" }), /PILOT_BH_ENABLED/);
  assert.throws(() => loadConfig({ PILOT_BH_ENABLED: "true", PILOT_BH_INVITED_EMAILS: "ana@example.test,ANA@example.test" }), /unique/);
  assert.deepEqual(pilot.invitedEmails, ["ana@example.test", "admin@example.test"]);
});

test("BH pilot accepts invited accounts and invalidates existing sessions of other accounts", async () => {
  let writes = 0;
  const auth = createAuthService({
    async createUserWithVerification() { writes++; assert.fail("Uninvited registration must not write"); },
    async findActiveSession() { return { id: userId, email: "outsider@example.test", role: "customer" }; },
  }, { pilotBh: pilot });
  await assert.rejects(auth.register({ email: "outsider@example.test", adultConfirmed: true, adultDeclarationVersion: "FC-AGE-1" }),
    error => error.code === "pilot_invitation_required");
  assert.equal(writes, 0);
  assert.equal(await auth.session("existing-session"), null);
});

test("BH pilot requires BH/MG for publication, address and institution application", async () => {
  assert.equal(pilotBhLocation(pilot, "Belo Horizonte", "mg"), true);
  assert.equal(pilotBhLocation(pilot, "Contagem", "MG"), false);
  assert.equal(pilotBhLocation(pilot, "Belo Horizonte", "SP"), false);
  assert.equal(pilotBhPostalCode(pilot, "30110-000"), true);
  assert.equal(pilotBhPostalCode(pilot, "32000-000"), false);
  const marketplace = createMarketplaceService({ async create() { assert.fail("Outside listing must not persist"); } }, null, null, { pilotBh: pilot });
  await assert.rejects(marketplace.create(userId, {
    title: "Pacote infantil fechado", description: "Pacote íntegro e fechado, dentro da validade informada.",
    kind: "sale", quantity: 20, priceCents: 3500, category: "infant", packageCondition: "sealed",
    brand: "Pampers", model: "Confort Sec", city: "Contagem", state: "MG",
  }), error => error.code === "pilot_outside_bh");
  const logistics = createLogisticsService({ async createAddress() { assert.fail("Outside address must not persist"); } }, null, null, { pilotBh: pilot });
  await assert.rejects(logistics.createAddress(userId, {
    label: "Casa", postalCode: "30110000", street: "Rua fictícia", number: "10", district: "Centro",
    city: "Contagem", state: "MG",
  }), error => error.code === "pilot_outside_bh");
  const institutions = createInstitutionService({ async createApplication() { assert.fail("Outside institution must not persist"); } }, { pilotBh: pilot });
  await assert.rejects(institutions.submit(userId, {
    legalName: "Instituto Cuidado Circular", publicName: "Cuidado Circular", taxId: "12345678000190",
    representativeName: "Ana Responsável", representativeEmail: "ana@example.test", city: "Contagem", state: "MG",
    addressLine: "Rua fictícia, 10", postalCode: "30110000", documentKeys: ["institutions/documento_01"],
  }), error => error.code === "pilot_outside_bh");
});

test("BH pilot rejects a non-capital postal code even when city and state say Belo Horizonte", async () => {
  const logistics = createLogisticsService({ async createAddress() { assert.fail("Outside CEP must not persist"); } }, null, null, { pilotBh: pilot });
  await assert.rejects(logistics.createAddress(userId, {
    label: "Casa", postalCode: "32000000", street: "Rua fictícia", number: "10", district: "Centro",
    city: "Belo Horizonte", state: "MG",
  }), error => error.code === "pilot_outside_bh");
  const institutions = createInstitutionService({ async createApplication() { assert.fail("Outside CEP must not persist"); } }, { pilotBh: pilot });
  await assert.rejects(institutions.submit(userId, {
    legalName: "Instituto Cuidado Circular", publicName: "Cuidado Circular", taxId: "12345678000190",
    representativeName: "Ana Responsável", representativeEmail: "ana@example.test", city: "Belo Horizonte", state: "MG",
    addressLine: "Rua fictícia, 10", postalCode: "32000000", documentKeys: ["institutions/documento_01"],
  }), error => error.code === "pilot_outside_bh");
});

test("BH pilot revalidates the stored postal code before institution activation", async () => {
  const institutionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const verification = { documentsChecked: true, representativeChecked: true, capacityChecked: true };
  for (const postalCode of ["32000000", "30110000"]) {
    const writes = [];
    const institutions = createInstitutionService({
      async detailAdmin() {
        return { status: "under_review", city: "Belo Horizonte", state: "MG", postal_code: postalCode, document_keys: ["institutions/documento_01"] };
      },
      async changeStatus(input) { writes.push(input); return { id: institutionId, status: input.status }; },
    }, { pilotBh: pilot });
    const operation = institutions.changeStatus(userId, institutionId, {
      status: "active", reason: "Conferência sintética concluída para o piloto.", verification,
    });
    if (postalCode === "32000000") {
      await assert.rejects(operation, error => error.code === "pilot_outside_bh" && error.status === 403);
      assert.deepEqual(writes, []);
    } else {
      assert.equal((await operation).status, "active");
      assert.equal(writes.length, 1);
      assert.deepEqual(writes[0].verification, verification);
    }
  }
});

test("BH pilot excludes old listings outside the city from search and new sales", async () => {
  const listingId = "22222222-2222-4222-8222-222222222222";
  let searchPilotFlag;
  const repository = {
    async search(input) { searchPilotFlag = input.pilotBh; return []; },
    async detail() { return { id: listingId, kind: "sale", city: "Contagem", state: "MG" }; },
    async startTransaction() { assert.fail("Outside sale must not start"); },
  };
  const marketplace = createMarketplaceService(repository, null, null, { pilotBh: pilot });
  await marketplace.search({});
  assert.equal(searchPilotFlag, true);
  await assert.rejects(marketplace.startTransaction(userId, listingId), error => error.code === "pilot_outside_bh");
  await assert.rejects(marketplace.detail(listingId), error => error.code === "listing_not_found");
  const db = { async query(sql, values) { assert.match(sql, /\$10::boolean/); assert.equal(values[9], true); return { rows: [] }; } };
  await createMarketplaceRepository(db).search({ pilotBh: true });
});

test("BH pilot keeps invited sessions and persists BH addresses", async () => {
  const auth = createAuthService({
    async findActiveSession() { return { id: userId, email: "ana@example.test", role: "customer" }; },
  }, { pilotBh: pilot });
  assert.equal((await auth.session("invited-session"))?.id, userId);
  const writes = [];
  const logistics = createLogisticsService({
    async createAddress(id, address) { writes.push({ id, address }); return { id: "address-1", ...address }; },
  }, null, null, { pilotBh: pilot });
  const saved = await logistics.createAddress(userId, {
    label: "Casa", postalCode: "30110000", street: "Rua fictícia", number: "10", district: "Centro",
    city: "Belo Horizonte", state: "mg",
  });
  assert.equal(saved.city, "Belo Horizonte");
  assert.equal(saved.state, "MG");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].id, userId);
});

test("BH pilot blocks exchange proposals when either existing listing is outside BH", async () => {
  const requestedListingId = "22222222-2222-4222-8222-222222222222";
  const offeredListingId = "33333333-3333-4333-8333-333333333333";
  const ownerId = "44444444-4444-4444-8444-444444444444";
  for (const outside of [requestedListingId, offeredListingId]) {
    let writes = 0;
    const database = { async transaction(operation) {
      return operation({ async query(sql) {
        if (!sql.startsWith("SELECT id,seller_id,kind,status,package_condition,city,state FROM listings")) {
          writes++;
          assert.fail("An outside-BH exchange must not write");
        }
        return { rows: [
          { id: requestedListingId, seller_id: ownerId, kind: "exchange", status: "published", package_condition: "sealed", city: outside === requestedListingId ? "Contagem" : "Belo Horizonte", state: "MG" },
          { id: offeredListingId, seller_id: userId, kind: "exchange", status: "published", package_condition: "sealed", city: outside === offeredListingId ? "Contagem" : "Belo Horizonte", state: "MG" },
        ] };
      } });
    } };
    const exchanges = createExchangeRepository(database, { pilotBh: pilot });
    await assert.rejects(exchanges.propose({ actorId: userId, requestedListingId, offeredListingId }),
      error => error.code === "pilot_outside_bh" && error.status === 403);
    assert.equal(writes, 0);
  }
});

test("BH pilot blocks donation confirmation when the listing or institution is outside BH", async () => {
  for (const outside of ["listing", "institution"]) {
    let writes = 0;
    const database = { async transaction(operation) {
      return operation({ async query(sql) {
        if (!sql.includes("FROM listings l JOIN institutions i")) {
          writes++;
          assert.fail("An outside-BH donation must not continue to a write or confirmation query");
        }
        return { rows: [{
          institution_id: "55555555-5555-4555-8555-555555555555",
          city: outside === "listing" ? "Contagem" : "Belo Horizonte", state: "MG",
          institution_city: outside === "institution" ? "Contagem" : "Belo Horizonte", institution_state: "MG",
        }] };
      } });
    } };
    const donations = createDonationRepository(database, { pilotBh: pilot });
    await assert.rejects(donations.create({ actorId: userId, listingId: "66666666-6666-4666-8666-666666666666", idempotencyKey: `outside-${outside}` }),
      error => error.code === "pilot_outside_bh" && error.status === 403);
    assert.equal(writes, 0);
  }
});

test("BH pilot blocks shipment creation for an existing listing outside BH", async () => {
  const transactionId = "77777777-7777-4777-8777-777777777777";
  const sellerId = "88888888-8888-4888-8888-888888888888";
  let queryNumber = 0;
  const database = { async transaction(operation) {
    return operation({ async query(sql) {
      queryNumber++;
      if (sql.startsWith("SELECT id,buyer_id,seller_id,status FROM transactions")) {
        return { rows: [{ id: transactionId, buyer_id: userId, seller_id: sellerId, status: "paid" }] };
      }
      if (sql.includes("FROM transactions t JOIN listings l")) {
        return { rows: [{ city: "Contagem", state: "MG" }] };
      }
      assert.fail("An outside-BH shipment must be blocked before persistence");
    } });
  } };
  const logistics = createLogisticsRepository(database, { pilotBh: pilot });
  await assert.rejects(logistics.createShipment({
    transactionId, buyerId: userId, sellerId, mode: "partner", insured: false, idempotencyKey: "pilot-outside-shipment",
  }), error => error.code === "pilot_outside_bh" && error.status === 403);
  assert.equal(queryNumber, 2);
});

test("BH pilot creates a shipment for a paid transaction in BH", async () => {
  const transactionId = "77777777-7777-4777-8777-777777777777";
  const sellerId = "88888888-8888-4888-8888-888888888888";
  const shipmentId = "99999999-9999-4999-8999-999999999999";
  const writes = [];
  const database = { async transaction(operation) {
    return operation({ async query(sql, values) {
      if (sql.startsWith("SELECT id,buyer_id,seller_id,status FROM transactions")) {
        return { rows: [{ id: transactionId, buyer_id: userId, seller_id: sellerId, status: "paid" }] };
      }
      if (sql.includes("FROM transactions t JOIN listings l")) return { rows: [{ city: "Belo Horizonte", state: "MG" }] };
      if (sql.startsWith("SELECT * FROM shipments WHERE idempotency_key")) return { rows: [] };
      if (sql.startsWith("SELECT id FROM shipments WHERE transaction_id")) return { rows: [] };
      if (sql.includes("INSERT INTO shipments")) {
        writes.push("shipment");
        return { rows: [{ id: shipmentId, transaction_id: transactionId, buyer_id: userId, seller_id: sellerId, mode: "partner", insured: false, status: "provider_pending" }] };
      }
      if (sql.includes("INSERT INTO shipment_events")) { writes.push("event"); return { rows: [] }; }
      if (sql.includes("INSERT INTO audit_events")) { writes.push("audit"); return { rows: [] }; }
      assert.fail(`Unexpected shipment query: ${sql.slice(0, 80)}`);
    } });
  } };
  const logistics = createLogisticsRepository(database, { pilotBh: pilot });
  const shipment = await logistics.createShipment({
    transactionId, buyerId: userId, sellerId, mode: "partner", insured: false, idempotencyKey: "pilot-bh-shipment",
  });
  assert.equal(shipment.id, shipmentId);
  assert.equal(shipment.status, "provider_pending");
  assert.deepEqual(writes, ["shipment", "event", "audit"]);
});

test("BH pilot blocks sharing a legacy address with a postal code outside the capital", async () => {
  const shipmentId = "99999999-9999-4999-8999-999999999999";
  const addressId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  let queryNumber = 0;
  const database = { async transaction(operation) {
    return operation({ async query(sql) {
      queryNumber++;
      if (sql.includes("FROM shipments s JOIN transactions t")) return { rows: [{
        id: shipmentId, transaction_id: "77777777-7777-4777-8777-777777777777", buyer_id: userId,
        seller_id: "88888888-8888-4888-8888-888888888888", courier_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        mode: "partner", status: "assigned", transaction_status: "paid", kind: "sale",
        collected: false, payment_confirmed: true, financial_issue: false,
      }] };
      if (sql.includes("FROM addresses WHERE id=$1 AND user_id=$2")) return { rows: [{
        id: addressId, label: "Casa", postal_code: "32000000", street: "Rua fictícia", number: "10",
        complement: null, district: "Centro", city: "Belo Horizonte", state: "MG",
      }] };
      assert.fail("A legacy address outside the BH postal range must not be shared");
    } });
  } };
  const logistics = createLogisticsRepository(database, { pilotBh: pilot });
  await assert.rejects(logistics.shareAddress({ actorId: userId, shipmentId, addressId }),
    error => error.code === "pilot_outside_bh" && error.status === 403);
  assert.equal(queryNumber, 2);
});
