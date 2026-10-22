import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../apps/api/server.js";
import { loadConfig } from "../apps/api/config.js";
import { createCourierEligibilityService } from "../apps/api/courier-eligibility-service.js";
import { createDatabase } from "../database/client.js";
import { createCourierEligibilityRepository } from "../database/courier-eligibility-repository.js";
import { discoverMigrations, migrate } from "../database/migrate.js";
import { nativePostgresTools, withNativeTestPostgres } from "../tools/native-postgres.mjs";

const native = await nativePostgresTools();
const ids = {
  courier: "11111111-1111-4111-8111-111111111111",
  admin: "22222222-2222-4222-8222-222222222222",
  document: "33333333-3333-4333-8333-333333333333",
  review: "44444444-4444-4444-8444-444444444444",
};

test("courier clearance rejection is enforced over HTTP and PostgreSQL", {
  skip: !native && !process.env.CI ? "PostgreSQL nativo ausente neste ambiente." : false,
  timeout: 60_000,
}, async () => {
  await withNativeTestPostgres(async databaseUrl => {
    const database = createDatabase({ databaseUrl, databaseSsl: false });
    let api;
    try {
      await migrate(database, await discoverMigrations());
      await database.query(`INSERT INTO users(id,email,password_hash,display_name,role) VALUES
        ($1,'courier-eligibility@example.test','fixture','Entregador fictício','courier'),
        ($2,'courier-reviewer@example.test','fixture','Revisor fictício','admin')`,
      [ids.courier, ids.admin]);
      await database.query(`INSERT INTO courier_profiles
        (user_id,identity_status,adult_confirmed_at,email_verified_at,phone_verified_at,
         payout_status,payout_provider_reference,terms_version,terms_accepted_at,
         admin_approval_status,admin_reviewer_id,admin_reviewed_at)
        VALUES($1,'verified',now(),now(),now(),'verified','payout-provider-fixture',
          'FC-COURIER-1',now(),'approved',$2,now())`, [ids.courier, ids.admin]);
      await database.query(`INSERT INTO courier_vehicles
        (courier_id,vehicle_type,status,driver_license_status,driver_license_expires_at,reviewed_by,reviewed_at)
        VALUES($1,'motorcycle','approved','verified',now()+interval '1 year',$2,now())`,
      [ids.courier, ids.admin]);
      await database.query(`INSERT INTO courier_clearance_reviewers(user_id,granted_by)
        VALUES($1,$1)`, [ids.admin]);
      await database.query(`INSERT INTO courier_clearance_documents
        (id,courier_id,issuer,encrypted_object_reference,encryption_key_reference,access_scope,
         retention_policy_version,retention_legal_approver_id)
        VALUES($1,$2,'police_civil','clearances/encrypted/http-fixture','keys/courier/http-fixture',
          'courier_clearance_reviewers','FC-PRIVACY-2026-01',$3)`,
      [ids.document, ids.courier, ids.admin]);
      await database.query(`INSERT INTO courier_clearance_reviews
        (id,document_id,review_kind,method,submission_reference,submitted_at,due_at)
        VALUES($1,$2,'initial','official_police_civil_channel','police-civil-http-fixture',
          now()-interval '1 hour',now()+interval '23 hours')`, [ids.review, ids.document]);

      const repository = createCourierEligibilityRepository(database);
      const service = createCourierEligibilityService(repository, {
        featureEnabled: true,
        clock: () => Date.parse("2026-10-22T12:00:00.000Z"),
      });
      const actors = {
        courier: { id: ids.courier, role: "courier" },
        admin: { id: ids.admin, role: "admin" },
      };
      api = createApiServer({
        config: loadConfig({ NODE_ENV: "test", RATE_LIMIT_MAX: "1000" }),
        courierEligibilityService: service,
        authService: { async session(token) { return actors[token] ?? null; } },
      });
      await new Promise(resolve => api.listen(0, "127.0.0.1", resolve));
      const base = `http://127.0.0.1:${api.address().port}`;
      const headers = token => ({ "content-type": "application/json", cookie: `fc_session=${token}` });

      const ownStatus = await fetch(`${base}/v1/courier/eligibility`, { headers: headers("courier") });
      const ownBody = await ownStatus.json();
      assert.equal(ownStatus.status, 200, JSON.stringify(ownBody));
      assert.equal(ownBody.eligibility.clearance.status, "pending_review");
      assert.equal(ownBody.eligibility.review.id, ids.review);

      const forbiddenQueue = await fetch(`${base}/v1/admin/courier-clearance/review-queue`, {
        headers: headers("courier"),
      });
      assert.equal(forbiddenQueue.status, 403);

      const queue = await fetch(`${base}/v1/admin/courier-clearance/review-queue?limit=10`, {
        headers: headers("admin"),
      });
      const queueBody = await queue.json();
      assert.equal(queue.status, 200, JSON.stringify(queueBody));
      assert.equal(queueBody.items.length, 1);
      assert.equal(queueBody.items[0].review_id, ids.review);

      const decision = await fetch(`${base}/v1/admin/courier-clearance/reviews/${ids.review}/decision`, {
        method: "POST",
        headers: headers("admin"),
        body: JSON.stringify({ decision: "rejected", auditReference: "review-audit-http-fixture" }),
      });
      const decisionBody = await decision.json();
      assert.equal(decision.status, 200, JSON.stringify(decisionBody));
      assert.equal(decisionBody.decision.accountSuspended, true);

      const finalStatus = await fetch(`${base}/v1/courier/eligibility`, { headers: headers("courier") });
      const finalBody = await finalStatus.json();
      assert.equal(finalStatus.status, 200, JSON.stringify(finalBody));
      assert.equal(finalBody.eligibility.profile.account_status, "suspended");
      assert.equal(finalBody.eligibility.clearance.status, "rejected");
      assert.equal(finalBody.eligibility.suspension.status, "suspended");

      const stored = (await database.query(`SELECT r.status AS review_status,d.status AS document_status,
        p.account_status,s.status AS suspension_status
        FROM courier_clearance_reviews r
        JOIN courier_clearance_documents d ON d.id=r.document_id
        JOIN courier_profiles p ON p.user_id=d.courier_id
        JOIN courier_clearance_suspensions s ON s.rejected_review_id=r.id
        WHERE r.id=$1`, [ids.review])).rows[0];
      assert.deepEqual(stored, {
        review_status: "rejected", document_status: "rejected",
        account_status: "suspended", suspension_status: "suspended",
      });
      assert.equal((await database.query(`SELECT count(*)::integer AS n FROM audit_events
        WHERE action='courier.clearance.review_decided' AND entity_id=$1`, [ids.review])).rows[0].n, 1);
    } finally {
      if (api?.listening) await new Promise(resolve => api.close(resolve));
      await database.close();
    }
  });
});
