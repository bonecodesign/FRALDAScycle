import assert from "node:assert/strict";
import test from "node:test";
import { buildAccountClosureRetentionPlan } from "../packages/contracts/account-closure-retention.js";

const inventory = { classification: "awaiting_legal_review", identityAndAccess: { sessions: 2, addresses: 1 }, family: { childProfiles: 1 }, consents: { termsAcceptances: 3, marketingEvents: 4 }, legalAndFinancial: { transactions: 5, supportTickets: 6 }, marketplaceContent: { listings: 2, media: 3 } };

test("retention plan applies approved periods without authorizing erasure", () => {
  const plan = buildAccountClosureRetentionPlan(inventory);
  assert.equal(plan.version, "FC-CLOSURE-RETENTION-1");
  assert.equal(plan.executionAllowed, false);
  assert.equal(plan.automaticErasureAllowed, false);
  assert.equal(plan.categories.find((item) => item.category === "transactions").retentionDays, 1825);
  assert.equal(plan.categories.find((item) => item.category === "support_tickets").commonRetentionDays, 365);
  assert.equal(plan.categories.find((item) => item.category === "child_profiles").backupExpiryDays, 30);
  assert.equal(plan.approvedGeneralRules.fullIpRetentionDays, 7);
  assert.equal(plan.externalDeletionReceiptsRequired, true);
});

test("retention plan rejects incomplete, negative or unreviewed inventories", () => {
  assert.throws(() => buildAccountClosureRetentionPlan({ ...inventory, classification: "approved" }), /invalid_account_closure_inventory/);
  assert.throws(() => buildAccountClosureRetentionPlan({ ...inventory, legalAndFinancial: { transactions: -1, supportTickets: 0 } }), /invalid_account_closure_inventory/);
  assert.throws(() => buildAccountClosureRetentionPlan({ ...inventory, consents: {} }), /invalid_account_closure_inventory/);
});
