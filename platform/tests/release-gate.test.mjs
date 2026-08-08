import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("local release gate covers every pre-homologation manifest", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const gate = packageJson.scripts["release:check-local"];

  assert.equal(typeof gate, "string");
  for (const command of [
    "npm run check:production",
    "npm test",
    "npm run providers:validate",
    "npm run providers:selection:validate",
    "npm run providers:diligence:validate",
    "npm run pilot:validate",
    "node ../qa-regression.mjs",
  ]) {
    assert.equal(gate.includes(command), true, "missing release gate command: " + command);
  }
});
