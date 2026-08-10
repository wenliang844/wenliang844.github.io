import { access, cp, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(ROOT, "temp", "astro-dist", "post");
const destination = join(ROOT, "post");

await access(join(source, "index.html"));
await cp(source, destination, { recursive: true, force: true });

const routes = (await readdir(source, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const outputs = [join(destination, "index.html"), ...routes.map((route) => join(destination, route, "index.html"))];

for (const output of outputs) {
  const html = await readFile(output, "utf8");
  if (!html.includes('<meta name="generator" content="Astro Content Collections">')) {
    throw new Error(`Astro output marker missing: ${output}`);
  }
}

console.log(`Astro routes synced: /post/ + ${routes.length} article pages.`);
