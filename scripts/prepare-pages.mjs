import assert from "node:assert/strict";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../apps/web/src/", import.meta.url));
const output = fileURLToPath(new URL("../dist/pages/", import.meta.url));
const basePath = "/FRALDAScycle";
const textExtensions = new Set([".css", ".html", ".js", ".json", ".svg", ".webmanifest"]);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });

async function rewrite(directory) {
  const { readdir } = await import("node:fs/promises");
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewrite(path);
      continue;
    }
    if (!textExtensions.has(extname(entry.name)) && entry.name !== "manifest.webmanifest") continue;

    const original = await readFile(path, "utf8");
    const prefixed = original
      .replaceAll('"/', `"${basePath}/`)
      .replaceAll("'/", `'${basePath}/`)
      .replaceAll(`"${basePath}/demo-api`, '"/demo-api')
      .replaceAll(`'${basePath}/demo-api`, "'/demo-api");
    await writeFile(path, prefixed);
  }
}

await rewrite(output);

const manifest = JSON.parse(await readFile(join(output, "manifest.webmanifest"), "utf8"));
assert.equal(manifest.start_url, `${basePath}/`);
assert.equal(manifest.scope, `${basePath}/`);

const index = await readFile(join(output, "index.html"), "utf8");
assert.match(index, new RegExp(`href="${basePath}/manifest\\.webmanifest"`));

const worker = await readFile(join(output, "service-worker.js"), "utf8");
assert.match(worker, new RegExp(`"${basePath}/dashboard\\.html"`));

console.log(`GitHub Pages bundle prepared at ${output}`);
