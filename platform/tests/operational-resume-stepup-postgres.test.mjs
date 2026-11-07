import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { createApiServer } from "../apps/api/server.js";
import { loadConfig } from "../apps/api/config.js";
import { hashPassword } from "../apps/api/security.js";
import { createAccountStepUpService } from "../apps/api/account-step-up-service.js";
import { createOperationalControlService } from "../apps/api/operational-control.js";
import { createAccountStepUpRepository } from "../database/account-step-up-repository.js";
import { createOperationalControlRepository } from "../database/operational-control-repository.js";
import { createDatabase } from "../database/client.js";
import { discoverMigrations, migrate } from "../database/migrate.js";
import { nativePostgresTools, withNativeTestPostgres } from "../tools/native-postgres.mjs";

const native = await nativePostgresTools();
const ids = {
  technician: "11111111-1111-4111-8111-111111111111",
  founder: "22222222-2222-4222-8222-222222222222",
};
const password = "FraldaCycle synthetic test password 2030";

test("operational resume requires independent password/email step-up and records both audit events", {
  skip: !native && !process.env.CI ? "PostgreSQL nativo ausente neste ambiente." : false,
  timeout: 90_000,
}, async () => {
  await withNativeTestPostgres(async databaseUrl => {
    const database = createDatabase({ databaseUrl, databaseSsl: false });
    let api;
    try {
      await migrate(database, await discoverMigrations());
      const passwordHash = await hashPassword(password);
      await database.query(`INSERT INTO users
        (id,email,password_hash,display_name,role,staff_access_level,staff_sector,email_verified_at)
        VALUES
        ($1,'synthetic-incident-tech@example.test',$3,'Técnico fictício','admin',4,'operations',now()),
        ($2,'synthetic-incident-founder@example.test',$3,'Fundador fictício','admin',5,'founder',now())`,
      [ids.technician, ids.founder, passwordHash]);

      const actors = {
        technician: { id: ids.technician, role: "admin", staffSector: "operations", staffAccessLevel: 4 },
        founder: { id: ids.founder, role: "admin", staffSector: "founder", staffAccessLevel: 5 },
      };
      const stepUpRepository = createAccountStepUpRepository(database);
      api = createApiServer({
        config: loadConfig({ NODE_ENV: "test", RATE_LIMIT_MAX: "1000" }),
        authService: { async session(token) { return actors[token] ?? null; } },
        accountStepUpService: createAccountStepUpService(stepUpRepository),
        operationalControlService: createOperationalControlService(
          createOperationalControlRepository(database, { stepUpRepository }),
        ),
      });
      await new Promise(resolve => api.listen(0, "127.0.0.1", resolve));
      const origin = `http://127.0.0.1:${api.address().port}`;
      const send = async (actor, method, path, body) => {
        const response = await fetch(origin + path, {
          method,
          headers: { cookie: `fc_session=${actor}`, "content-type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return { status: response.status, body: await response.json() };
      };
      const requestGrant = async (actor, email) => {
        const issued = await send(actor, "POST", "/v1/account/step-up/request",
          { password, purpose: "operational_resume" });
        assert.equal(issued.status, 202, JSON.stringify(issued.body));
        const outbox = (await database.query(`SELECT payload->>'token' AS code
          FROM notification_outbox WHERE kind='account_step_up' AND recipient=$1
          ORDER BY id DESC LIMIT 1`, [email])).rows[0];
        assert.match(outbox.code, /^\d{6}$/);
        const verified = await send(actor, "POST", "/v1/account/step-up/confirm",
          { challenge: issued.body.challenge, code: outbox.code, purpose: "operational_resume" });
        assert.equal(verified.status, 200, JSON.stringify(verified.body));
        assert.ok(verified.body.grantId);
        return verified.body.grantId;
      };

      const pause = await send("technician", "PUT", "/v1/admin/operational-control", {
        domain: "marketplace", action: "pause",
        reason: "Teste isolado: suspeita de comprometimento do marketplace.", confirmed: true,
      });
      assert.equal(pause.status, 200, JSON.stringify(pause.body));
      assert.equal(pause.body.state.paused, true);
      const directResume = await send("founder", "PUT", "/v1/admin/operational-control", {
        domain: "marketplace", action: "resume",
        reason: "Retomada direta não autorizada pelo fluxo operacional.", confirmed: true,
      });
      assert.equal(directResume.status, 409);
      assert.equal(directResume.body.error.code, "joint_resume_approval_required");

      const technicianGrant = await requestGrant("technician", "synthetic-incident-tech@example.test");
      const proposed = await send("technician", "POST", "/v1/admin/operational-resume-requests", {
        domain: "marketplace", reason: "Recuperação técnica validada em ambiente fictício.",
        grantId: technicianGrant,
      });
      assert.equal(proposed.status, 201, JSON.stringify(proposed.body));
      assert.equal(proposed.body.request.status, "pending");
      const requestId = proposed.body.request.id;

      const blocked = await send("technician", "POST", "/v1/listings", {});
      assert.equal(blocked.status, 503);
      assert.equal(blocked.body.error.code, "operational_paused");

      // The technician cannot approve their own proposal, and a valid grant
      // cannot be borrowed by the founder from another account.
      const technicianDecision = await send("technician", "POST",
        `/v1/admin/operational-resume-requests/${requestId}/decision`, {
          approved: true, reason: "Técnico não pode decidir pela conta do fundador.",
          grantId: technicianGrant,
        });
      assert.equal(technicianDecision.status, 403);
      const borrowedGrant = await send("founder", "POST",
        `/v1/admin/operational-resume-requests/${requestId}/decision`, {
          approved: true, reason: "Confirmação do técnico não pode autorizar o fundador.",
          grantId: technicianGrant,
        });
      assert.equal(borrowedGrant.status, 409);
      assert.equal(borrowedGrant.body.error.code, "operational_resume_step_up_required");

      const founderGrant = await requestGrant("founder", "synthetic-incident-founder@example.test");
      const decided = await send("founder", "POST",
        `/v1/admin/operational-resume-requests/${requestId}/decision`, {
          approved: true, reason: "Fundador confirma recuperação técnica independente.",
          grantId: founderGrant,
        });
      assert.equal(decided.status, 200, JSON.stringify(decided.body));
      assert.equal(decided.body.request.status, "approved");
      assert.equal(decided.body.state.paused, false);

      const state = (await database.query(
        "SELECT paused,version,changed_by FROM operational_controls WHERE domain='marketplace'",
      )).rows[0];
      assert.equal(state.paused, false);
      assert.equal(state.changed_by, ids.founder);
      assert.equal(Number(state.version), 3);

      const audit = (await database.query(`SELECT action,actor_user_id,metadata
        FROM audit_events WHERE entity_type='operational_control' AND entity_id='marketplace'
        ORDER BY occurred_at,id`)).rows;
      assert.deepEqual(audit.map(item => item.action), ["operations.paused", "operations.resumed"]);
      assert.equal(audit[1].actor_user_id, ids.founder);
      assert.equal(audit[1].metadata.resumeRequestId, requestId);
      assert.equal(audit[1].metadata.previousPaused, true);
      assert.equal(audit[1].metadata.newPaused, false);
      assert.equal(Number(audit[1].metadata.previousVersion), 2);
      assert.equal(Number(audit[1].metadata.newVersion), 3);

      // Neither the founder's consumed grant nor the completed decision can
      // authorize a second operation.
      const replay = await send("founder", "POST",
        `/v1/admin/operational-resume-requests/${requestId}/decision`, {
          approved: true, reason: "Tentativa sintética de repetir autorização já usada.",
          grantId: founderGrant,
        });
      assert.equal(replay.status, 409);
      assert.equal(replay.body.error.code, "operational_resume_step_up_required");
      const count = (await database.query(`SELECT count(*)::int AS total FROM audit_events
        WHERE entity_type='operational_control' AND entity_id='marketplace' AND action='operations.resumed'`)).rows[0];
      assert.equal(count.total, 1);

      // Independent confirmed grants isolate the version-conflict branch.
      // These fixtures are NOT evidence of email delivery; the first
      // scenario above exercises password + outbox email code end-to-end.
      const seedConfirmedGrant = async (userId) => {
        const token = (await database.query(`INSERT INTO auth_tokens
          (user_id,kind,token_hash,expires_at)
          VALUES($1,'account_step_up',$2,now()+interval '10 minutes') RETURNING id`,
        [userId, randomBytes(32)])).rows[0];
        return (await database.query(`INSERT INTO account_step_up_requests
          (user_id,auth_token_id,challenge_hash,purpose,expires_at,confirmed_at)
          VALUES($1,$2,$3,'operational_resume',now()+interval '10 minutes',now()) RETURNING id`,
        [userId, token.id, randomBytes(32)])).rows[0].id;
      };
      const pauseLogistics = await send("technician", "PUT", "/v1/admin/operational-control", {
        domain: "logistics", action: "pause", confirmed: true,
        reason: "Pausa sintética para prova de versão concorrente.",
      });
      assert.equal(pauseLogistics.status, 200);
      const staleProposal = await send("technician", "POST", "/v1/admin/operational-resume-requests", {
        domain: "logistics", reason: "Proposta sintética antes da mudança concorrente.",
        grantId: await seedConfirmedGrant(ids.technician),
      });
      assert.equal(staleProposal.status, 201, JSON.stringify(staleProposal.body));
      const extraPause = await send("technician", "PUT", "/v1/admin/operational-control", {
        domain: "logistics", action: "pause", confirmed: true,
        reason: "Nova contenção sintética invalida a versão da proposta anterior.",
      });
      assert.equal(extraPause.status, 200);
      const staleDecision = await send("founder", "POST",
        `/v1/admin/operational-resume-requests/${staleProposal.body.request.id}/decision`, {
          approved: true, reason: "Versão antiga não pode reativar a logística.",
          grantId: await seedConfirmedGrant(ids.founder),
        });
      assert.equal(staleDecision.status, 200, JSON.stringify(staleDecision.body));
      assert.equal(staleDecision.body.request.status, "superseded");
      assert.equal(staleDecision.body.state, null);
      const logistics = (await database.query(
        "SELECT paused FROM operational_controls WHERE domain='logistics'",
      )).rows[0];
      assert.equal(logistics.paused, true);
      const unsafeResumes = (await database.query(`SELECT count(*)::int AS total
        FROM audit_events WHERE entity_type='operational_control'
          AND entity_id='logistics' AND action='operations.resumed'`)).rows[0].total;
      assert.equal(unsafeResumes, 0);
    } finally {
      if (api?.listening) await new Promise(resolve => api.close(resolve));
      await database.close();
    }
  });
});
