import assert from "node:assert/strict";
import test from "node:test";
import { createDatabase } from "../database/client.js";
import { discoverMigrations, migrate } from "../database/migrate.js";
import { createCourierEligibilityRepository } from "../database/courier-eligibility-repository.js";
import { nativePostgresTools, withNativeTestPostgres } from "../tools/native-postgres.mjs";

const native = await nativePostgresTools();
const courier = "11111111-1111-4111-8111-111111111111";
const reviewer = "22222222-2222-4222-8222-222222222222";
const ids = {
  multiple: "33333333-3333-4333-8333-333333333333",
  rejected: "44444444-4444-4444-8444-444444444444",
  expired: "55555555-5555-4555-8555-555555555555",
  missing: "66666666-6666-4666-8666-666666666666",
};

test("P-01 legacy migration refuses missing decisions then deterministically shortens multiple, rejected and overdue records in PostgreSQL", {
  skip: !native && !process.env.CI ? "PostgreSQL nativo indisponível." : false,
  timeout: 120_000,
}, async () => withNativeTestPostgres(async databaseUrl => {
  const database = createDatabase({ databaseUrl, databaseSsl: false });
  try {
    const migrations = await discoverMigrations();
    const retention = migrations.find(x => x.name === "150_courier_clearance_verification_retention.sql");
    assert.ok(retention);
    await migrate(database, migrations.filter(x => x !== retention));

    await database.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
      ($1,'legacy-p01-courier@example.test','fixture','Courier fictício','courier'),
      ($2,'legacy-p01-reviewer@example.test','fixture','Reviewer fictício','admin')`,
      [courier, reviewer]);
    await database.query("INSERT INTO courier_profiles(user_id) VALUES($1)", [courier]);
    await database.query("INSERT INTO courier_clearance_reviewers(user_id,granted_by) VALUES($1,$1)",[reviewer]);

    const documents = [
      [ids.multiple,"verified","2029-12-01","2031-01-01","2031-01-31"],
      [ids.rejected,"rejected",null,null,null],
      [ids.expired,"expired","2029-01-01","2029-08-01","2029-08-31"],
      [ids.missing,"verified","2028-12-01","2031-01-01","2031-01-31"],
    ];
    for (let index=0;index<documents.length;index++){
      const [id,status,issued,expires,deadline]=documents[index];
      await database.query(`INSERT INTO courier_clearance_documents
        (id,courier_id,status,issuer,validity_source,issuer_verification_reference,
         issued_at,expires_at,encrypted_object_reference,encryption_key_reference,
         access_scope,retention_policy_version,retention_legal_approver_id,delete_at)
        VALUES($1,$2,$3,'police_civil',$4,$5,$6,$7,$8,$9,
          'courier_clearance_reviewers','FC-PRIVACY-TEST',$10,$11)`,
        [id,courier,status,issued?"issuer_document":null,issued?"issuer-fixture-"+index:null,
          issued && issued+"T00:00:00Z",expires && expires+"T00:00:00Z",
          "restricted/legacy/fixture-"+index,"kms/legacy/fixture-"+index,reviewer,
          deadline && deadline+"T00:00:00Z"]);
    }

    const decisions = [
      [ids.multiple,"initial","approved","2029-12-31","2030-01-01","a"],
      [ids.multiple,"renewal","approved","2030-01-14","2030-01-15","b"],
      [ids.rejected,"initial","rejected","2030-01-09","2030-01-10","c"],
      [ids.expired,"initial","approved","2029-06-30","2029-07-01","d"],
    ];
    async function addReview([id,kind,status,submitted,decided,suffix]){
      await database.query(`INSERT INTO courier_clearance_reviews
        (document_id,review_kind,status,method,submission_reference,submitted_at,due_at,
         reviewer_id,decided_at,audit_reference)
        VALUES($1,$2,$3,'official_police_civil_channel',$4,$5::timestamptz,
         $5::timestamptz + interval '24 hours',$6,$7::timestamptz,$8)`,
        [id,kind,status,"legacy-p01-submission-"+suffix,submitted+"T00:00:00Z",
          reviewer,decided+"T00:00:00Z","legacy-p01-audit-"+suffix]);
    }
    for (const decision of decisions) await addReview(decision);

    // No reliable decision for this verified legacy record: never guess a deadline.
    await assert.rejects(migrate(database,[retention]),
      /P-01 legacy clearance review decision missing: manual privacy review required/);
    const applied=(await database.query(
      "SELECT count(*)::integer AS n FROM schema_migrations WHERE name=$1",[retention.name])).rows[0];
    assert.equal(applied.n,0,"Failed preflight must not record migration");
    const stillOld=(await database.query(
      "SELECT delete_at FROM courier_clearance_documents WHERE id=$1",[ids.multiple])).rows[0];
    assert.equal(stillOld.delete_at.toISOString(),"2031-01-31T00:00:00.000Z",
      "Fail-closed migration must roll back deadline changes");

    await addReview([ids.missing,"initial","approved","2028-12-31","2029-01-01","e"]);
    await migrate(database,[retention]);
    const rows=(await database.query(`SELECT id,status,delete_at,
      encrypted_object_reference,encryption_key_reference
      FROM courier_clearance_documents WHERE courier_id=$1`,[courier])).rows;
    const byId = new Map(rows.map(row => [row.id,row]));
    assert.equal(byId.get(ids.multiple).delete_at.toISOString(),"2030-01-31T00:00:00.000Z",
      "Use first of two reviews, never a nondeterministic later decision");
    assert.equal(byId.get(ids.rejected).delete_at.toISOString(),"2030-02-09T00:00:00.000Z",
      "Rejected copy has a deadline even when old delete_at was NULL");
    assert.equal(byId.get(ids.expired).delete_at.toISOString(),"2029-07-31T00:00:00.000Z",
      "An overdue expired copy must stay overdue");
    assert.equal(byId.get(ids.missing).delete_at.toISOString(),"2029-01-31T00:00:00.000Z");
    assert.ok(rows.every(row => row.encrypted_object_reference && row.encryption_key_reference),
      "Migration must not claim external deletion or clear storage references without a receipt");

    const repository=createCourierEligibilityRepository(database);
    const scheduled=await repository.scheduleMaintenanceTasks({
      actorId:null, now:"2030-02-10T12:00:00.000Z",
    });
    assert.equal(scheduled.copyDeletion,4,"Past-due documents must remain eligible for restricted deletion tasks");
    assert.equal((await database.query(`SELECT count(*)::integer AS n
      FROM courier_eligibility_maintenance_tasks WHERE task_kind='clearance_copy_delete'`)).rows[0].n,4);
    assert.equal((await database.query(`SELECT count(*)::integer AS n
      FROM courier_clearance_documents WHERE status='deleted'`)).rows[0].n,0,
      "Task scheduling does not delete an external object or fake a receipt");
  } finally { await database.close(); }
}));
