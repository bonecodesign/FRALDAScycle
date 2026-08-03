import assert from "node:assert/strict";
import test from "node:test";
import { checksum, migrate } from "../database/migrate.js";

function fakeDatabase(applied = []) {
  const events = [];
  return {
    events,
    async query(sql) {
      events.push(["query", sql]);
      if (sql.startsWith("SELECT name")) return { rows: applied };
      return { rows: [] };
    },
    async transaction(operation) {
      const writes = [];
      events.push(["transaction", writes]);
      return operation({ query: async (...args) => writes.push(args) });
    },
  };
}

test("migration checksums are deterministic", () => {
  assert.equal(checksum("SELECT 1"), checksum("SELECT 1"));
  assert.notEqual(checksum("SELECT 1"), checksum("SELECT 2"));
});

test("migration runner applies pending files in transactions", async () => {
  const database = fakeDatabase();
  const migrations = [
    { name: "001_first.sql", sql: "SELECT 1", checksum: checksum("SELECT 1") },
    { name: "002_second.sql", sql: "SELECT 2", checksum: checksum("SELECT 2") },
  ];
  assert.deepEqual(await migrate(database, migrations), ["001_first.sql", "002_second.sql"]);
  const transactions = database.events.filter(([type]) => type === "transaction");
  assert.equal(transactions.length, 2);
  assert.equal(transactions[0][1][1][0], "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)");
});

test("migration runner refuses modified history", async () => {
  const database = fakeDatabase([{ name: "001_first.sql", checksum: "outro-checksum" }]);
  await assert.rejects(
    migrate(database, [{ name: "001_first.sql", sql: "SELECT 1", checksum: checksum("SELECT 1") }]),
    /Applied migration changed/,
  );
});

test("migration runner skips already applied immutable files", async () => {
  const sql = "SELECT 1";
  const database = fakeDatabase([{ name: "001_first.sql", checksum: checksum(sql) }]);
  await migrate(database, [{ name: "001_first.sql", sql, checksum: checksum(sql) }]);
  assert.equal(database.events.filter(([type]) => type === "transaction").length, 0);
});
