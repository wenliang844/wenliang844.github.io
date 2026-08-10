import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";

const ROOT = join(import.meta.dirname, "..");
const outfile = join(ROOT, "js", "editor-codemirror.js");
const options = {
  entryPoints: [join(ROOT, "src", "editor-codemirror.ts")],
  bundle: true,
  format: "iife",
  legalComments: "none",
  minify: true,
  target: ["es2020"],
};

if (process.argv.includes("--check")) {
  const result = await build({ ...options, write: false });
  const output = result.outputFiles[0].text;
  let current = "";
  try {
    current = await readFile(outfile, "utf8");
  } catch {
    // A missing bundle is reported by the same stale-output error below.
  }
  if (current !== output) {
    console.error("js/editor-codemirror.js is stale. Run npm run build:editor.");
    process.exitCode = 1;
  } else {
    console.log("CodeMirror bundle is current.");
  }
} else {
  await build({ ...options, outfile });
  console.log("CodeMirror bundle built: js/editor-codemirror.js");
}
