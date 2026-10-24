const fail = (code, status, message) => Object.assign(new Error(message), { code, status });

export function createManufacturerCatalogRepository(database) {
  return Object.freeze({
    async importBatch({ actorId, catalog }) {
      return database.transaction(async client => {
        const batch = (await client.query(`INSERT INTO manufacturer_catalog_batches
          (manufacturer,source_url,document_sha256,effective_date,imported_by)
          VALUES($1,$2,$3,$4,$5) RETURNING *`, [catalog.manufacturer, catalog.sourceUrl,
          catalog.documentSha256, catalog.effectiveDate, actorId])).rows[0];
        await client.query(`INSERT INTO manufacturer_catalog_entries
          (batch_id,product_key,category,brand,model,size,min_age_months,max_age_months,min_weight_kg,max_weight_kg)
          SELECT $1,x.product_key,x.category,x.brand,x.model,x.size,x.min_age_months,x.max_age_months,x.min_weight_kg,x.max_weight_kg
          FROM jsonb_to_recordset($2::jsonb) AS x(product_key text,category text,brand text,model text,size text,
            min_age_months integer,max_age_months integer,min_weight_kg numeric,max_weight_kg numeric)`,
        [batch.id, JSON.stringify(catalog.entries.map(entry => ({ product_key: entry.productKey,
          category: entry.category, brand: entry.brand, model: entry.model, size: entry.size,
          min_age_months: entry.minAgeMonths, max_age_months: entry.maxAgeMonths,
          min_weight_kg: entry.minWeightKg, max_weight_kg: entry.maxWeightKg })))]);
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,'manufacturer_catalog.imported','manufacturer_catalog',$2,$3::jsonb)`,
        [actorId, batch.id, JSON.stringify({ manufacturer: catalog.manufacturer,
          documentSha256: catalog.documentSha256, entryCount: catalog.entries.length })]);
        return batch;
      });
    },

    async reviewBatch({ actorId, batchId, expectedVersion, decision, reason }) {
      return database.transaction(async client => {
        const batch = (await client.query("SELECT * FROM manufacturer_catalog_batches WHERE id=$1 FOR UPDATE", [batchId])).rows[0];
        if (!batch) throw fail("manufacturer_catalog_not_found", 404, "Lote de catálogo não encontrado.");
        if (batch.version !== expectedVersion) throw fail("manufacturer_catalog_version_conflict", 409, "O lote foi atualizado; consulte novamente.");
        if (!["pending_first_review", "pending_second_review"].includes(batch.status)
            || actorId === batch.imported_by || actorId === batch.first_reviewer_id) {
          throw fail("manufacturer_catalog_independent_review_required", 403, "Outra pessoa autorizada deve revisar este lote.");
        }
        let updated;
        if (decision === "reject") {
          updated = (await client.query(`UPDATE manufacturer_catalog_batches SET status='rejected',rejected_by=$2,
            rejection_reason=$3,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`,
          [batchId, actorId, reason])).rows[0];
        } else if (batch.status === "pending_first_review") {
          updated = (await client.query(`UPDATE manufacturer_catalog_batches SET status='pending_second_review',
            first_reviewer_id=$2,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`,
          [batchId, actorId])).rows[0];
        } else {
          await client.query(`UPDATE manufacturer_catalog_batches SET status='superseded',activated_at=NULL,
            version=version+1,updated_at=now() WHERE lower(manufacturer)=lower($1) AND status='active'`,
          [batch.manufacturer]);
          updated = (await client.query(`UPDATE manufacturer_catalog_batches SET status='active',second_reviewer_id=$2,
            activated_at=now(),version=version+1,updated_at=now() WHERE id=$1 RETURNING *`,
          [batchId, actorId])).rows[0];
        }
        await client.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata)
          VALUES($1,$2,'manufacturer_catalog',$3,$4::jsonb)`, [actorId,
          decision === "reject" ? "manufacturer_catalog.rejected" : "manufacturer_catalog.approved",
          batchId, JSON.stringify({ previousStatus: batch.status, status: updated.status, version: updated.version })]);
        return updated;
      });
    },
  });
}
