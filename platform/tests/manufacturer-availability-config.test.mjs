import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../apps/api/config.js";

const base = { NODE_ENV: "development", CORS_ORIGINS: "" };
test("fixed availability sources are parsed as HTTPS-only immutable configuration", () => {
  const config = loadConfig({ ...base, MANUFACTURER_AVAILABILITY_FIXED_SOURCES: "https://a.example, https://b.example" });
  assert.deepEqual(config.manufacturerAvailabilityFixedSources, ["https://a.example", "https://b.example"]);
  assert.throws(() => loadConfig({ ...base, MANUFACTURER_AVAILABILITY_FIXED_SOURCES: "http://unsafe.example" }), /HTTPS URLs/);
  assert.throws(() => loadConfig({ ...base, MANUFACTURER_AVAILABILITY_FIXED_SOURCES: "https://a.example,https://a.example" }), /duplicates/);
});
