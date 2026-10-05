import assert from "node:assert/strict";
import test from "node:test";
import { createMarketplaceRepository } from "../database/marketplace-repository.js";
import { createMarketplaceService } from "../apps/api/marketplace-service.js";

test("neither party can conclude through the legacy route before receipt controls exist", async () => {
  const repository = createMarketplaceRepository({
    async transaction() { assert.fail("must not write completion"); },
    async query() { assert.fail("must not write completion"); },
  });
  const service = createMarketplaceService(repository);
  for (const actor of ["buyer", "seller"]) {
    await assert.rejects(service.completeTransaction(actor, "transaction-1"),
      (error) => error.code === "receipt_confirmation_not_configured" && error.status === 503);
  }
});
