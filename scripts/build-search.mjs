#!/usr/bin/env node

import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = join(ROOT, "pagefind");
const PAGEFIND_RUNNER = join(ROOT, "node_modules", "pagefind", "lib", "runner", "bin.cjs");
const PAGE_GLOB = "{index.html,post/**/*.html,categories/**/*.html,series/**/*.html,knowledge/**/*.html,tags/**/*.html,tools/**/*.html,chat/**/*.html,ai/**/*.html,appreciation/**/*.html,sponsor/**/*.html}";

export function assertSearchOutputPath(root, outputDir) {
  const expected = join(resolve(root), "pagefind");
  if (resolve(outputDir) !== expected) {
    throw new Error(`Refusing to clean unexpected Pagefind output: ${outputDir}`);
  }
}

export async function cleanSearchOutput(root = ROOT, outputDir = join(root, "pagefind")) {
  assertSearchOutputPath(root, outputDir);
  await rm(outputDir, { recursive: true, force: true });
}

export async function buildSearch() {
  await cleanSearchOutput();
  const args = [
    PAGEFIND_RUNNER,
    "--site", ".",
    "--output-subdir", "pagefind",
    "--glob", PAGE_GLOB,
    "--force-language", "zh",
    "--include-characters", "+#_.",
  ];
  const result = await new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => resolvePromise({ code, signal }));
  });
  if (result.code !== 0) {
    const reason = result.signal ? `signal ${result.signal}` : `exit code ${result.code}`;
    throw new Error(`Pagefind build failed (${reason}).`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildSearch().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
