import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";

const ROOT = join(import.meta.dirname, "..");
const bundles = [
  {
    name: "CodeMirror",
    entry: join(ROOT, "src", "editor-codemirror.ts"),
    outfile: join(ROOT, "js", "editor-codemirror.js"),
  },
  {
    name: "Site runtime",
    entry: join(ROOT, "src", "client", "site-runtime.ts"),
    outfile: join(ROOT, "js", "coder.js"),
    footer: { js: "SiteRuntime.initSiteRuntime();" },
    globalName: "SiteRuntime",
  },
];

function buildOptions(bundle) {
  return {
    entryPoints: [bundle.entry],
    bundle: true,
    format: "iife",
    legalComments: "none",
    minify: true,
    target: ["es2020"],
    globalName: bundle.globalName,
    footer: bundle.footer,
  };
}

if (process.argv.includes("--check")) {
  let stale = false;
  for (const bundle of bundles) {
    const result = await build({ ...buildOptions(bundle), write: false });
    const output = result.outputFiles[0].text;
    let current = "";
    try {
      current = await readFile(bundle.outfile, "utf8");
    } catch {
      // A missing bundle is reported by the same stale-output error below.
    }
    if (current !== output) {
      console.error(`${bundle.outfile} is stale. Run npm run build:editor.`);
      stale = true;
    } else {
      console.log(`${bundle.name} bundle is current.`);
    }
  }
  if (stale) process.exitCode = 1;
} else {
  for (const bundle of bundles) {
    await build({ ...buildOptions(bundle), outfile: bundle.outfile });
    console.log(`${bundle.name} bundle built: ${bundle.outfile}`);
  }
}
