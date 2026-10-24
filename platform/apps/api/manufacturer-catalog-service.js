import { requireScope } from "./authorization.js";
import { ServiceError } from "./service-error.js";
import { parseManufacturerCatalogCsv } from "../../packages/contracts/manufacturer-catalog-import.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createManufacturerCatalogService(repository) {
  return Object.freeze({
    async importBatch(actor, input) {
      requireScope(actor, "admin:catalog:write");
      let catalog;
      try { catalog = parseManufacturerCatalogCsv(input?.csv, input); }
      catch (error) { throw new ServiceError(error.code ?? "invalid_catalog_csv", 422, "O arquivo de catálogo é inválido."); }
      return repository.importBatch({ actorId: actor.id, catalog });
    },
    async reviewBatch(actor, batchId, input) {
      requireScope(actor, "admin:catalog:write");
      const decision = String(input?.decision ?? "");
      const reason = String(input?.reason ?? "").trim();
      if (!UUID.test(batchId) || !["approve", "reject"].includes(decision)
          || !Number.isInteger(input?.expectedVersion) || input.expectedVersion < 1
          || reason.length < 10 || reason.length > 1_000 || input?.confirmed !== true) {
        throw new ServiceError("invalid_catalog_review", 422, "Confirme a decisão, a versão e uma justificativa válida.");
      }
      return repository.reviewBatch({ actorId: actor.id, batchId, expectedVersion: input.expectedVersion,
        decision, reason });
    },
  });
}
