import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("local release gate advances without activating external integrations", async () => {
  const [packageJson, runbook] = await Promise.all([
    readFile(new URL("package.json", root), "utf8").then(JSON.parse),
    readFile(new URL("docs/production-runbook.md", root), "utf8"),
  ]);

  assert.match(packageJson.scripts["release:check-local"], /check:production/);
  assert.match(packageJson.scripts["release:check-local"], /providers:validate/);
  assert.match(packageJson.scripts["release:check-local"], /qa-regression\.mjs/);
  assert.doesNotMatch(packageJson.scripts["release:check-local"], /production:doctor/);
  assert.match(runbook, /integrações externas estão adiadas/i);
  assert.match(runbook, /não declara o ambiente pronto para produção/i);
});

test("release workflow validates code before publishing versioned images", async () => {
  const [releaseWorkflow, platformWorkflow] = await Promise.all([
    readFile(new URL("../.github/workflows/release-images.yml", root), "utf8"),
    readFile(new URL("../.github/workflows/platform.yml", root), "utf8"),
  ]);

  assert.match(releaseWorkflow, /validate:/);
  assert.match(releaseWorkflow, /npm run release:check-local/);
  assert.match(releaseWorkflow, /needs: validate/);
  assert.match(releaseWorkflow, /\^v\[0-9\]\+/);
  assert.match(platformWorkflow, /- "app\.js"/);
  assert.match(platformWorkflow, /- "qa-regression\.mjs"/);
  assert.match(platformWorkflow, /Validate synchronized prototype/);
});
