import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function isMainModule(importMetaUrl, entryPath = process.argv[1]) {
  return typeof entryPath === "string"
    && entryPath.length > 0
    && importMetaUrl === pathToFileURL(resolve(entryPath)).href;
}
