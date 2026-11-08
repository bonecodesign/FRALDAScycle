import assert from "node:assert/strict";
import test from "node:test";
import { createDatabase } from "../database/client.js";
import { discoverMigrations, migrate } from "../database/migrate.js";
import { createCourierEligibilityRepository } from "../database/courier-eligibility-repository.js";
import { createCourierEligibilityMaintenanceWorker } from "../apps/api/courier-eligibility-maintenance.js";
import { nativePostgresTools, withNativeTestPostgres } from "../tools/native-postgres.mjs";

const native = await nativePostgresTools();
const courierId = "11111111-1111-4111-8111-111111111111";
const reviewerId = "22222222-2222-4222-8222-222222222222";
const documentId = "33333333-3333-4333-8333-333333333333";
const reference = "restricted/clearance/synthetic-p01";
const keyReference = "kms/synthetic-key-do-not-store";
const now = "2030-02-01T12:00:00.000Z";
const receipt = {
  reference: "synthetic_receipt_20300201",
  confirmedAt: now,
};

test("P-01 PostgreSQL migrates an existing certificate, persists the deletion receipt and clears both restricted pointers atomically", {
  skip: !native && !process.env.CI ? "PostgreSQL nativo indisponível." : false,
  timeout: 120_000,
}, async () => {
  await withNativeTestPostgres(async databaseUrl => {
    const database = createDatabase({ databaseUrl, databaseSsl: false });
    try {
      const migrations = await discoverMigrations();
      const retention = migrations.find(item => item.name === "150_courier_clearance_verification_retention.sql");
      assert.ok(retention, "P-01 draft migration must be present");
      await migrate(database, migrations.filter(item => item !== retention));

      await database.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
        ($1,'courier-p01@example.test','fixture','Courier fictício','courier'),
        ($2,'reviewer-p01@example.test','fixture','Reviewer fictício','admin')`,
      [courierId, reviewerId]);
      await database.query("INSERT INTO courier_profiles(user_id) VALUES($1)", [courierId]);
      await database.query("INSERT INTO courier_clearance_reviewers(user_id,granted_by) VALUES($1,$1)", [reviewerId]);
      await database.query(`INSERT INTO courier_clearance_documents
        (id,courier_id,status,issuer,validity_source,issuer_verification_reference,
         issued_at,expires_at,encrypted_object_reference,encryption_key_reference,
         access_scope,retention_policy_version,retention_legal_approver_id,delete_at)
        VALUES($1,$2,'verified','police_civil','issuer_document','issuer-fixture',
         '2029-12-01T00:00:00Z','2031-01-01T00:00:00Z',$3,$4,
         'courier_clearance_reviewers','FC-PRIVACY-TEST',$5,'2031-01-31T00:00:00Z')`,
      [documentId,courierId,reference,keyReference,reviewerId]);
      await database.query(`INSERT INTO courier_clearance_reviews
        (document_id,review_kind,status,method,submission_reference,submitted_at,due_at,reviewer_id,decided_at,audit_reference)
        VALUES($1,'initial','approved','official_police_civil_channel',
         'synthetic-submission-p01','2029-12-31T00:00:00Z','2030-01-01T00:00:00Z',
         $2,'2030-01-01T00:00:00Z','synthetic-review-p01')`,[documentId,reviewerId]);

      // Migration 150 must shorten (never extend) the old issuer-expiry deadline.
      await migrate(database, [retention]);
      const afterMigration = (await database.query(
        "SELECT delete_at FROM courier_clearance_documents WHERE id=$1",[documentId])).rows[0];
      assert.equal(afterMigration.delete_at.toISOString(), "2030-01-31T00:00:00.000Z");

      await database.query(`INSERT INTO courier_eligibility_maintenance_tasks
        (task_key,task_kind,courier_id,document_id,scheduled_for)
        VALUES('clearance_copy_delete:synthetic-p01','clearance_copy_delete',$1,$2,'2030-01-31T00:00:00Z')`,
      [courierId,documentId]);

      const repository = createCourierEligibilityRepository(database);
      const [claimed] = await repository.claimMaintenanceTasks({ limit: 5, now });
      assert.ok(claimed, "A deletion obligation must be claimable");

      // Caller cannot bypass the storage confirmation or claim a different object.
      await assert.rejects(
        repository.completeMaintenanceTask(claimed, {
          now, outcome: "clearance_copy_deleted", expectedObjectReference: reference,
        }),
        error => error.code === "clearance_deletion_receipt_required",
      );
      await assert.rejects(
        repository.completeMaintenanceTask(claimed, {
          now, outcome: "clearance_copy_deleted", expectedObjectReference: reference + "-wrong",
          deletionConfirmation: receipt,
        }),
        error => error.code === "clearance_deletion_context_mismatch",
      );
      const beforeDeletion = (await database.query(`SELECT status,encrypted_object_reference,encryption_key_reference
        FROM courier_clearance_documents WHERE id=$1`,[documentId])).rows[0];
      assert.equal(beforeDeletion.status, "verified");
      assert.equal(beforeDeletion.encrypted_object_reference, reference);
      assert.equal(beforeDeletion.encryption_key_reference, keyReference);
      assert.equal((await database.query(`SELECT count(*)::integer AS n FROM audit_events
        WHERE action='courier.eligibility.maintenance_completed'`)).rows[0].n, 0);

      await repository.failMaintenanceTask(claimed, { availableAt: now, error: "synthetic retry for validated receipt" });
      let storageCalls=0;
      const worker = createCourierEligibilityMaintenanceWorker(repository, {
        clock: () => Date.parse(now),
        restrictedStorageAdapter: { async deleteObject(objectReference) {
          storageCalls += 1;
          assert.equal(objectReference, reference);
          return {
            deleted: true, objectReference,
            confirmationReference: receipt.reference,
            confirmedAt: receipt.confirmedAt,
          };
        } },
      });
      assert.deepEqual(await worker.run(), { claimed: 1, completed: 1, deferred: 0, failed: 0 });
      assert.equal(storageCalls, 1);

      const document = (await database.query(`SELECT status,deleted_at,expires_at,
        encrypted_object_reference,encryption_key_reference FROM courier_clearance_documents WHERE id=$1`,
      [documentId])).rows[0];
      assert.equal(document.status, "deleted");
      assert.equal(document.encrypted_object_reference, null);
      assert.equal(document.encryption_key_reference, null);
      assert.ok(document.deleted_at);
      // The issuer validity remains available as non-secret eligibility history.
      assert.equal(document.expires_at.toISOString(), "2031-01-01T00:00:00.000Z");

      const [completed] = (await database.query(`SELECT id,status,completed_at FROM courier_eligibility_maintenance_tasks
        WHERE document_id=$1 AND task_kind='clearance_copy_delete'`,[documentId])).rows;
      assert.equal(completed.status, "completed");
      const events = (await database.query(`SELECT metadata FROM audit_events
        WHERE action='courier.eligibility.maintenance_completed' AND entity_id=$1`,[completed.id])).rows;
      assert.equal(events.length, 1);
      assert.deepEqual(events[0].metadata.deletionConfirmation, {
        reference: receipt.reference, confirmedAt: receipt.confirmedAt,
      });
      const rawAudit = JSON.stringify(events[0].metadata);
      assert.equal(rawAudit.includes(reference), false, "Audit must not reveal storage reference");
      assert.equal(rawAudit.includes(keyReference), false, "Audit must not reveal encryption key reference");
      assert.equal(await repository.completeMaintenanceTask(claimed, {
        now, outcome: "clearance_copy_deleted", expectedObjectReference: reference,
        deletionConfirmation: receipt,
      }),false,"Stale claim cannot duplicate a deletion");
      assert.equal((await database.query(`SELECT count(*)::integer AS n FROM audit_events
        WHERE action='courier.eligibility.maintenance_completed'`)).rows[0].n,1);

      await assert.rejects(
        repository.restrictedDocument({
          actorId:reviewerId,documentId,purpose:"verification",
          requestReference:"synthetic-restricted-document-after-purge",
        }),
        error => error.code === "clearance_document_access_denied",
      );
    } finally { await database.close(); }
  });
});
