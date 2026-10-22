import assert from "node:assert/strict";
import test from "node:test";
import { internalSupportPolicy } from "../packages/contracts/support-hours.js";
import { createMarketplaceService } from "../apps/api/marketplace-service.js";

test("internal support identifies service hours in Sao Paulo without promising resolution", () => {
  const open = internalSupportPolicy("2026-10-21T15:00:00Z");
  assert.equal(open.open, true);
  assert.equal(open.queueState, "within_service_hours");
  assert.equal(open.firstResponseTargetBusinessDays, 2);
  assert.equal(open.resolutionGuaranteed, false);
  const evening = internalSupportPolicy("2026-10-21T22:00:00Z");
  assert.equal(evening.open, false);
  assert.equal(evening.queueState, "received_outside_service_hours");
  assert.equal(internalSupportPolicy("2026-10-24T15:00:00Z").open, false);
  assert.throws(() => internalSupportPolicy("invalid"), /valid date/);
});

test("support tickets are accepted outside service hours with explicit queue policy", async () => {
  const created = { ticket: { id: "11111111-1111-4111-8111-111111111111", protocol: "42" }, reused: false };
  const service = createMarketplaceService({ async createSupportTicket() { return created; } }, null, null, {
    now: () => new Date("2026-10-24T15:00:00Z"),
  });
  const result = await service.createSupportTicket("user", {
    category: "general", subject: "Ajuda no cadastro", details: "Solicitação sintética para atendimento.", idempotencyKey: "support-hours-123456",
  });
  assert.equal(result.ticket.protocol, "42");
  assert.equal(result.supportPolicy.open, false);
  assert.equal(result.supportPolicy.queueState, "received_outside_service_hours");
  assert.equal(result.supportPolicy.firstResponseTargetBusinessDays, 2);
  assert.equal(result.supportPolicy.resolutionGuaranteed, false);
});
