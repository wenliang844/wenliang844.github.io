import { access, cp, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ASTRO_OUTPUT = join(ROOT, "temp", "astro-dist");
const ROUTE_ROOTS = ["post", "categories", "series", "tags", "knowledge"];
const ASSET_ROOT = "_astro";

async function collectHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectHtmlFiles(path);
    return entry.isFile() && entry.name.endsWith(".html") ? [path] : [];
  }));
  return nested.flat();
}

const outputs = [];
for (const routeRoot of ROUTE_ROOTS) {
  const source = join(ASTRO_OUTPUT, routeRoot);
  const destination = join(ROOT, routeRoot);
  await access(join(source, "index.html"));
  const sourceOutputs = await collectHtmlFiles(source);
  await cp(source, destination, { recursive: true, force: true });
  outputs.push(...sourceOutputs.map((output) => join(destination, output.slice(source.length + 1))));
}

const assetSource = join(ASTRO_OUTPUT, ASSET_ROOT);
const assetDestination = join(ROOT, ASSET_ROOT);
await access(assetSource);
await rm(assetDestination, { recursive: true, force: true });
await cp(assetSource, assetDestination, { recursive: true, force: true });

for (const output of outputs) {
  const html = await readFile(output, "utf8");
  if (!html.includes('<meta name="generator" content="Astro Content Collections">')) {
    throw new Error(`Astro output marker missing: ${output}`);
  }
}

console.log(`Astro routes synced: ${outputs.length} HTML pages and Vite assets across ${ROUTE_ROOTS.map((root) => `/${root}/`).join(", ")}.`);
