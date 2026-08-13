import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { transform } from "esbuild";

const ROOT = join(import.meta.dirname, "..", "..");

export async function loadClientModule(dom, relativePath, globalName) {
  const source = await readFile(join(ROOT, relativePath), "utf8");
  const { code } = await transform(source, {
    format: "iife",
    globalName,
    loader: "ts",
    target: "es2022",
  });
  dom.window.eval(code);
  return dom.window[globalName];
}

export async function evaluateClientModule(dom, relativePath, globalName, initializer) {
  const clientModule = await loadClientModule(dom, relativePath, globalName);
  clientModule[initializer]();
  return dom;
}
