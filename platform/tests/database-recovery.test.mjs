import assert from "node:assert/strict";
import test from "node:test";
import { createBackupPlan, createRestorePlan } from "../database/recovery.js";

test("backup uses custom compressed format without exposing credentials in arguments", () => {
  const plan = createBackupPlan({
    DATABASE_URL: "postgresql://operator:secret@db.internal:5433/fraldacycle?sslmode=require",
    DATABASE_DUMP_PATH: "./backups/fraldacycle.dump",
  });
  assert.equal(plan.command, "pg_dump");
  assert.ok(plan.args.includes("--format=custom"));
  assert.equal(plan.args.join(" ").includes("secret"), false);
  assert.equal(plan.env.PGPASSWORD, "secret");
  assert.equal(plan.env.PGSSLMODE, "require");
});

test("restore requires explicit authorization and targets a separate database", () => {
  assert.throws(() => createRestorePlan({
    RESTORE_DATABASE_URL: "postgresql://operator:secret@db.internal/restore",
    DATABASE_DUMP_PATH: "./backup.dump",
  }), /authorize restoration/);
  const plan = createRestorePlan({
    CONFIRM_DATABASE_RESTORE: "RESTORE",
    RESTORE_DATABASE_URL: "postgresql://operator:secret@db.internal/restore",
    DATABASE_DUMP_PATH: "./backup.dump",
  });
  assert.equal(plan.command, "pg_restore");
  assert.ok(plan.args.includes("--exit-on-error"));
  assert.ok(plan.args.includes("restore"));
  assert.equal(plan.args.join(" ").includes("secret"), false);
});
