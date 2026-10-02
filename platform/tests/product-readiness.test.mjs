import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("separa demonstração local de produção e aplica escopo visual do admin", async () => {
  const [auth, server, plan] = await Promise.all([
    read("apps/admin/auth.js"),
    read("tools/dev-server.mjs"),
    read("docs/product-readiness-plan.md"),
  ]);

  assert.match(auth, /const ROLE_NAVIGATION/);
  assert.match(auth, /function applyNavigationScope/);
  assert.match(auth, /link\.hidden = !visible/);
  assert.match(auth, /princípio do menor privilégio/);
  assert.match(auth, /Modo local demonstrativo/);
  assert.match(server, /x-fraldacycle-mode/);
  assert.match(server, /local-demo/);
  assert.match(plan, /Glossário de confiança/);
  assert.match(plan, /Homologação com pessoas/);
  assert.match(plan, /Integrações reais/);
});

test("proveniência das três superfícies acompanha a main atual", async () => {
  const sources = await Promise.all([
    read("apps/site/source.json"),
    read("apps/app/source.json"),
    read("apps/admin/source.json"),
  ]);
  for (const source of sources) assert.match(source, /6e85098af7d7cf941bccf7e83e86f68e83f2c0af/);
});
