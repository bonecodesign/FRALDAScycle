import assert from "node:assert/strict";
import test from "node:test";
import { runChildProfileLifecycleWorker } from "../workers/child-profile-lifecycle.js";

test("child profile lifecycle worker is explicit, bounded and closes its database", async () => {
  const calls = [];
  const database = { async close() { calls.push("close"); } };
  const result = await runChildProfileLifecycleWorker({
    mode: "once",
    env: { DATABASE_URL: "postgres://127.0.0.1/fraldacycle", DATABASE_SSL: "false" },
    createDb(options) { calls.push(["database", options]); return database; },
    createRepository(value) {
      assert.equal(value, database);
      return { async process(referenceDate) { assert.ok(referenceDate instanceof Date); calls.push("process"); return { warnings: 1, closed: 1 }; } };
    },
  });
  assert.equal(result, undefined);
  assert.deepEqual(calls, [["database", { databaseUrl: "postgres://127.0.0.1/fraldacycle", databaseSsl: false }], "process", "close"]);
});

test("periodic child profile lifecycle worker requires an explicit production gate", async () => {
  await assert.rejects(
    runChildProfileLifecycleWorker({ mode: "serve", env: { DATABASE_URL: "postgres://db.internal/fraldacycle", NODE_ENV: "production" } }),
    /CHILD_PROFILE_LIFECYCLE_ENABLED=true/,
  );
  await assert.rejects(
    runChildProfileLifecycleWorker({ mode: "once", env: { DATABASE_URL: "postgres://db.internal/fraldacycle" } }),
    /somente PostgreSQL local/,
  );
});
