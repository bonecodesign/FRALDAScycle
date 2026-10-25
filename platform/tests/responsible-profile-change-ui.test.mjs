import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../apps/app/responsible-profile-change.js", import.meta.url), "utf8");
const profile = await readFile(new URL("../apps/app/profile.js", import.meta.url), "utf8");

test("configurações oferecem alteração em duas etapas sem persistir dados sensíveis no navegador", () => {
  assert.match(profile, /responsible-profile-change\.js/);
  for (const field of ["fullName", "birthDate", "password", "code"]) assert.match(source, new RegExp(`name=\\"${field}\\"`));
  assert.match(source, /responsible-profile\/change\/request/);
  assert.match(source, /responsible-profile\/change\/confirm/);
  assert.match(source, /pending = \{ challenge: result\.challenge, change \}/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie/);
  assert.match(source, /autocomplete=\"current-password\"/);
  assert.match(source, /autocomplete=\"one-time-code\"/);
});
