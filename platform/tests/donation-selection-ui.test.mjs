import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("donation operations expose stable non-sensitive identifiers for deterministic selection", async () => {
  const source = await readFile(new URL("../apps/app/donations.js", import.meta.url), "utf8");
  assert.match(source, /b\.dataset\.transactionId=item\.transaction_id/);
  assert.match(source, /b\.dataset\.shipmentId=item\.shipment_id/);
  assert.doesNotMatch(source, /dataset\.(?:email|phone|address|document)/i);
});
