import assert from "node:assert/strict";
import test from "node:test";
import { AdminError } from "../apps/api/admin-service.js";
import { InstitutionError } from "../apps/api/institution-service.js";
import { LogisticsError } from "../apps/api/logistics-service.js";
import { MarketplaceError } from "../apps/api/marketplace-service.js";
import { PaymentError } from "../apps/api/payment-service.js";
import { ProviderError } from "../apps/api/marketplace-providers.js";

const errors = [AdminError, InstitutionError, LogisticsError, MarketplaceError, PaymentError, ProviderError];

test("service error classes preserve identity and their public error contract", () => {
  for (const ErrorClass of errors) {
    assert.equal(ErrorClass.length, 3);
    for (const args of [["forbidden", 403, "Acesso não autorizado."], ["unavailable", 503, "Indisponível."], []]) {
      const error = new ErrorClass(...args);
      assert.ok(error instanceof ErrorClass);
      assert.ok(error instanceof Error);
      assert.equal(error.constructor, ErrorClass);
      assert.equal(error.name, "Error");
      assert.equal(error.message, args[2] ?? "");
      assert.equal(error.code, args[0]);
      assert.equal(error.status, args[1]);
      assert.deepEqual(Object.keys(error).sort(), ["code", "status"]);
      assert.ok(error.stack.includes(error.message));
      for (const OtherClass of errors.filter(value => value !== ErrorClass)) {
        assert.equal(error instanceof OtherClass, false);
      }
    }
  }
});
