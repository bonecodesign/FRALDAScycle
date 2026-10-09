import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createAdminRepository } from "../database/admin-repository.js";
import { createAdminService } from "../apps/api/admin-service.js";

function database() {
  const calls = [];
  const client = { async query(sql, values = []) {
    calls.push({ sql, values });
    if (/FROM users GROUP BY role/.test(sql)) return { rows: [{ role: "admin", user_count: 1, active_count: 1, email_verified_count: 1 }] };
    if (/payment_event_count/.test(sql)) return { rows: [{ payment_event_count: 2, logistics_event_count: 1 }] };
    if (/events ORDER BY processed_at/.test(sql)) return { rows: [{ domain: "payment", id: "event-real", event_type: "payment.paid" }] };
    if (/unit_count FROM listings/.test(sql)) return { rows: [{ listing_count: 1, published_count: 1, review_count: 0, paused_count: 0, unit_count: "40" }] };
    if (/FROM listings l JOIN users u/.test(sql)) return { rows: [{ id: "listing-real", title: "Pacote real", seller_name: "Conta real", status: "published" }] };
    if (/active_user_count/.test(sql)) return { rows: [{ active_user_count: 3, transaction_count: 2, paid_volume_cents: "5000", shipment_count: 1 }] };
    if (/FROM transactions t JOIN listings/.test(sql)) return { rows: [{ id: "transaction-real", kind: "sale", status: "completed" }] };
    if (/FROM payment_intents p$/.test(sql.trim())) return { rows: [{ payment_count: 2, paid_volume_cents: "5000", paid_count: 1, pending_count: 1, exception_count: 0 }] };
    if (/FROM payment_intents p/.test(sql)) return { rows: [{ id: "payment-real", amount_cents: 5000, status: "paid" }] };
    if (/FROM shipments$/.test(sql.trim())) return { rows: [{ shipment_count: 1, awaiting_pickup_count: 0, assigned_count: 0, in_transit_count: 1, delivered_count: 0, exception_count: 0 }] };
    if (/FROM shipments s/.test(sql)) return { rows: [{ id: "shipment-real", status: "in_transit" }] };
    return { rows: [] };
  } };
  return { calls, async transaction(work) { return work(client); } };
}

test("webhook snapshot reports only persisted inbound events and audits access", async () => {
  const db = database();
  const result = await createAdminRepository(db).webhookSnapshot({ actorUserId: "admin-webhooks", limit: 25, offset: 0 });
  assert.equal(result.summary.payment_event_count, 2);
  assert.equal(result.items[0].id, "event-real");
  const query = db.calls.find(({ sql }) => /events ORDER BY processed_at/.test(sql));
  assert.doesNotMatch(query.sql, /payload_hash|provider_reference/);
  assert.equal(db.calls.find(({ sql }) => /admin\.webhook_events\.read/.test(sql)).values[0], "admin-webhooks");
});

test("access and catalog snapshots use persisted records and audit the administrator", async () => {
  const accessDb = database();
  const access = await createAdminRepository(accessDb).accessSnapshot({ actorUserId: "admin-access" });
  assert.equal(access.items[0].role, "admin");
  assert.equal(accessDb.calls.find(({ sql }) => /admin\.access_snapshot\.read/.test(sql)).values[0], "admin-access");

  const catalogDb = database();
  const catalog = await createAdminRepository(catalogDb).catalogSnapshot({ actorUserId: "admin-catalog", query: null, status: null, limit: 20, offset: 0 });
  assert.equal(catalog.summary.unit_count, "40");
  assert.equal(catalog.items[0].id, "listing-real");
  assert.equal(catalogDb.calls.find(({ sql }) => /admin\.catalog_snapshot\.read/.test(sql)).values[0], "admin-catalog");
});

test("overview snapshot aggregates local records without personal details and audits access", async () => {
  const db = database();
  const result = await createAdminRepository(db).overviewSnapshot({ actorUserId: "admin-0", limit: 10 });
  assert.equal(result.summary.active_user_count, 3);
  assert.equal(result.items[0].id, "transaction-real");
  const recent = db.calls.find(({ sql }) => /FROM transactions t JOIN listings/.test(sql));
  assert.doesNotMatch(recent.sql, /display_name|email|phone/);
  const audit = db.calls.find(({ sql }) => /admin\.overview_snapshot\.read/.test(sql));
  assert.equal(audit.values[0], "admin-0");
});

test("finance snapshot returns persisted rows and audits the real administrator", async () => {
  const db = database();
  const result = await createAdminRepository(db).financeSnapshot({ actorUserId: "admin-1", limit: 20, offset: 0 });
  assert.equal(result.summary.paid_volume_cents, "5000");
  assert.equal(result.items[0].id, "payment-real");
  const audit = db.calls.find(({ sql }) => /admin\.finance_snapshot\.read/.test(sql));
  assert.equal(audit.values[0], "admin-1");
  assert.match(db.calls[1].sql, /payment_cases/);
});

test("logistics snapshot returns persisted rows and audits the real administrator", async () => {
  const db = database();
  const result = await createAdminRepository(db).logisticsSnapshot({ actorUserId: "admin-2", limit: 20, offset: 0 });
  assert.equal(result.summary.shipment_count, 1);
  assert.equal(result.items[0].id, "shipment-real");
  const audit = db.calls.find(({ sql }) => /admin\.logistics_snapshot\.read/.test(sql));
  assert.equal(audit.values[0], "admin-2");
  assert.match(db.calls[1].sql, /delivery_proofs/);
});

test("admin service constrains pagination and forwards the actor identity", async () => {
  const calls = [];
  const repository = {
    async overviewSnapshot(input) { calls.push(input); return { summary: {}, items: [] }; },
    async financeSnapshot(input) { calls.push(input); return { summary: {}, items: [] }; },
    async logisticsSnapshot(input) { calls.push(input); return { summary: {}, items: [] }; },
  };
  const service = createAdminService(repository);
  await service.overviewSnapshot({ id: "admin" }, { limit: "999" });
  await service.financeSnapshot({ id: "admin" }, { limit: "999", offset: "3" });
  await service.logisticsSnapshot({ id: "admin" }, { limit: "0", offset: "-2" });
  assert.deepEqual(calls, [
    { actorUserId: "admin", limit: 50 },
    { actorUserId: "admin", limit: 100, offset: 3 },
    { actorUserId: "admin", limit: 50, offset: 0 },
  ]);
});

test("dashboard, reports and alerts contain no synthetic operational claims", async () => {
  const files = await Promise.all(["index.html", "reports.html", "alerts.html", "admin-overview.js"].map(name => readFile(new URL(`../apps/admin/${name}`, import.meta.url), "utf8")));
  const content = files.join("\n");
  for (const fiction of ["512.980", "5.432", "97,3%", "99,97%", "Carlos Silva", "Ana Souza", "dados simulados", "data-resolve-alert", "data-report-export"]) {
    assert.equal(content.includes(fiction), false, `fiction remained: ${fiction}`);
  }
  assert.match(content, /overview-snapshot/);
  assert.match(content, /Exportar CSV real/);
  assert.match(content, /Observabilidade ainda indisponível/);
});

test("users, catalog and roles expose real controls without fictional records", async () => {
  const files = await Promise.all(["users.html", "ads.html", "roles.html", "account-management.js"].map(name => readFile(new URL(`../apps/admin/${name}`, import.meta.url), "utf8")));
  const content = files.join("\n");
  for (const fiction of ["1.248", "6.421", "12.580", "Ana Souza", "Juliana Silva", "Carlos Silva", "Marina Lima", "data-ad-action", "rbac-save", "rbac-new-role"]) {
    assert.equal(content.includes(fiction), false, `fiction remained: ${fiction}`);
  }
  assert.match(content, /\/v1\/admin\/users/);
  assert.match(content, /\/v1\/admin\/catalog-snapshot/);
  assert.match(content, /\/v1\/admin\/access-snapshot/);
  assert.match(content, /Papéis personalizados/);
});

test("data, forecast and infrastructure disclose capabilities without simulated execution", async () => {
  const files = await Promise.all(["data.html", "forecast.html", "infrastructure.html", "intelligence.js"].map(name => readFile(new URL(`../apps/admin/${name}`, import.meta.url), "utf8")));
  const content = files.join("\n");
  for (const fiction of ["2,98 TB", "1.248.920", "97,8%", "3.250", "91,8%", "99,97%", "5.000", "1.250", "380 ms", "Nota A", "CloudFront", "Multi-AZ"]) {
    assert.equal(content.includes(fiction), false, `fiction remained: ${fiction}`);
  }
  assert.doesNotMatch(files[3], /setTimeout|notify|data-run-pipeline|forecast-refresh|infra-load-test/);
  assert.match(files[0], /ETL e orquestração/);
  assert.match(files[1], /Nenhum modelo preditivo está em operação/);
  assert.match(files[2], /pré-contrato/);
});

test("security and settings remove fictional guarantees while moderation keeps real API flows", async () => {
  const [security, settings, moderation, securityController, moderationController] = await Promise.all(["security.html", "settings.html", "moderation.html", "security-management.js", "moderation-management.js"].map(name => readFile(new URL(`../apps/admin/${name}`, import.meta.url), "utf8")));
  const content = `${security}\n${settings}`;
  for (const fiction of ["100%", "12 de 12", "Vulnerabilidades críticas", "AES-256", "TLS 1.3", "RPO 15", "data-integration-test", "platform-save"]) {
    assert.equal(content.includes(fiction), false, `fiction remained: ${fiction}`);
  }
  assert.match(securityController, /\/v1\/admin\/sessions/);
  assert.match(securityController, /sessions\/revoke-others/);
  assert.doesNotMatch(securityController, /innerHTML|insertAdjacentHTML|setTimeout/);
  assert.match(moderation, /Fluxo persistido/);
  assert.match(moderationController, /\/v1\/moderation\/decisions/);
  assert.match(moderationController, /\/v1\/moderation\/suspensions/);
});

test("audit and webhooks use persisted read-only evidence without fictional telemetry", async () => {
  const [page, controller] = await Promise.all(["audit.html", "governance.js"].map(name => readFile(new URL(`../apps/admin/${name}`, import.meta.url), "utf8")));
  for (const fiction of ["12.842", "99,94%", "Integridade da trilha", "Marina Lima", "Carlos Silva", "200.184", "worker-pay", "Streaming ativo", "data-webhook-retry", "Reprocessar"]) {
    assert.equal(`${page}${controller}`.includes(fiction), false, `fiction remained: ${fiction}`);
  }
  assert.match(controller, /\/v1\/admin\/audit-events/);
  assert.match(controller, /\/v1\/admin\/webhook-events/);
  assert.match(controller, /audit-events\.csv/);
  assert.doesNotMatch(controller, /innerHTML|insertAdjacentHTML|setTimeout/);
});

test("partnerships, innovation and launch disclose real maturity and use persisted support", async () => {
  const [partnerships, innovation, launch, growth, support] = await Promise.all(["partnerships.html", "innovation.html", "launch.html", "growth.js", "support-management.js"].map(name => readFile(new URL(`../apps/admin/${name}`, import.meta.url), "utf8")));
  const content = `${partnerships}\n${innovation}\n${launch}\n${growth}`;
  for (const fiction of ["R$ 512.980", "COOPERE", "ECOBABY", "1.842", "Ideias enviadas", "5 experimentos", "75%", "3.250", "Lançamento bem-sucedido", "R$ 12.840", "99,8%", "Produção publicada", "WhatsApp", "25.000+", "setTimeout", "data-partner-review", "data-experiment-review", "data-launch-evidence"]) {
    assert.equal(content.includes(fiction), false, `fiction remained: ${fiction}`);
  }
  assert.match(partnerships, /Nenhuma parceria comercial/);
  assert.match(innovation, /Backlog não priorizado/);
  assert.match(launch, /ensaio interno/);
  assert.match(support, /\/v1\/support\/tickets/);
  assert.doesNotMatch(support, /innerHTML|insertAdjacentHTML|setTimeout/);
});

test("finance and logistics pages expose honest empty states and no former fictional records", async () => {
  const [finance, logistics, controller] = await Promise.all([
    readFile(new URL("../apps/admin/finance.html", import.meta.url), "utf8"),
    readFile(new URL("../apps/admin/logistics.html", import.meta.url), "utf8"),
    readFile(new URL("../apps/admin/truthful-operations.js", import.meta.url), "utf8"),
  ]);
  for (const fiction of ["512.980", "PAY-8421", "Ana → Juliana", "99,2%", "1.248", "Carlos Silva", "FC-8F3A2B", "97,2%", "Mapa demonstrativo"]) {
    assert.equal(`${finance}${logistics}`.includes(fiction), false, `fiction remained: ${fiction}`);
  }
  assert.match(finance, /finance-empty/);
  assert.match(logistics, /logistics-empty/);
  assert.match(logistics, /proof-review-submit/);
  assert.match(controller, /Dados operacionais indisponíveis/);
  assert.doesNotMatch(controller, /innerHTML|insertAdjacentHTML/);
});
