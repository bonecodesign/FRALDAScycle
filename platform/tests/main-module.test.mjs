import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { isMainModule } from "../packages/contracts/main-module.js";

test("main-module detection accepts the platform-native entry path", () => {
  const entryPath = resolve("tools", "production-doctor.mjs");
  assert.equal(isMainModule(pathToFileURL(entryPath).href, entryPath), true);
});

test("main-module detection rejects imports and absent entry paths", () => {
  const entryPath = resolve("tools", "production-doctor.mjs");
  const importedPath = resolve("tools", "pilot-readiness.mjs");
  assert.equal(isMainModule(pathToFileURL(importedPath).href, entryPath), false);
  assert.equal(isMainModule(pathToFileURL(entryPath).href, undefined), false);
});
