import assert from "node:assert/strict";
import test from "node:test";
import { tokens, setTheme } from "./index.js";

test("preserva os tokens oficiais extraídos do protótipo", () => {
  assert.equal(tokens.color.primary, "#16A34A");
  assert.equal(tokens.color.secondary, "#2563EB");
  assert.equal(tokens.color.support, "#7C3AED");
  assert.equal(tokens.color.warning, "#F59E0B");
  assert.equal(tokens.color.error, "#EF4444");
  assert.deepEqual(tokens.motion, { fast: 150, standard: 250, slow: 300 });
  assert.deepEqual(tokens.breakpoint.desktop, { min: 992, columns: 12, gutter: 24 });
});

test("normaliza e persiste o tema sem depender do navegador", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  const root = { dataset: {} };

  assert.equal(setTheme("dark", { storage, root }), "dark");
  assert.equal(root.dataset.theme, "dark");
  assert.equal(values.get("fraldacycle-theme"), "dark");
  assert.equal(setTheme("unsupported", { storage, root }), "light");
});
