#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderServiceWorker } from "../src/service-worker-template.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUTPUT = "service-worker.js";

function parseArgs(argv) {
  const outIndex = argv.indexOf("--out");
  const outputPath = outIndex === -1 ? DEFAULT_OUTPUT : argv[outIndex + 1];
  if (!outputPath || outputPath.startsWith("--")) {
    throw new Error("--out requires a file path");
  }
  return {
    check: argv.includes("--check"),
    outputPath,
  };
}

function assertInsideRoot(path, label) {
  const rel = relative(ROOT, path);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`${label} must stay inside the repository root: ${path}`);
  }
}

async function writeGeneratedServiceWorker(outputPath = DEFAULT_OUTPUT) {
  const absoluteOutput = resolve(ROOT, outputPath);
  assertInsideRoot(absoluteOutput, "service worker output");
  const body = `${renderServiceWorker()}\n`;
  await mkdir(dirname(absoluteOutput), { recursive: true });
  await writeFile(absoluteOutput, body, "utf8");
  return { outputPath, body };
}

async function checkGeneratedServiceWorker(outputPath = DEFAULT_OUTPUT) {
  const absoluteOutput = resolve(ROOT, outputPath);
  assertInsideRoot(absoluteOutput, "service worker output");
  const expected = `${renderServiceWorker()}\n`;
  const actual = await readFile(absoluteOutput, "utf8");
  return {
    outputPath,
    ok: actual === expected,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.check) {
    const result = await checkGeneratedServiceWorker(options.outputPath);
    if (!result.ok) {
      console.error(`${result.outputPath} is stale. Run npm run generate:service-worker and commit the result.`);
      process.exitCode = 1;
      return;
    }
    console.log(`Service worker generation check passed for ${result.outputPath}.`);
    return;
  }

  await writeGeneratedServiceWorker(options.outputPath);
  console.log(`Wrote ${options.outputPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export {
  DEFAULT_OUTPUT,
  checkGeneratedServiceWorker,
  parseArgs,
  writeGeneratedServiceWorker,
};
