#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  DEFAULT_BASELINE_MAX_AGE_HOURS,
  DEFAULT_OUTPUT,
  validateQualityBaseline,
} from "./quality-baseline-core.mjs";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function optionsFromArgs(argv) {
  const consumedIndexes = new Set();
  ["--file", "--max-age-hours"].forEach((flag) => {
    const index = argv.indexOf(flag);
    if (index !== -1) {
      consumedIndexes.add(index);
      consumedIndexes.add(index + 1);
    }
  });
  const file =
    valueAfter(argv, "--file") ||
    argv.find((value, index) => value && !value.startsWith("--") && !consumedIndexes.has(index)) ||
    DEFAULT_OUTPUT;
  const maxAgeValue = valueAfter(argv, "--max-age-hours");
  const maxAgeHours = maxAgeValue === undefined ? DEFAULT_BASELINE_MAX_AGE_HOURS : Number(maxAgeValue);
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) {
    throw new Error("--max-age-hours must be a positive number");
  }

  return {
    file,
    maxAgeHours,
    requireHead: argv.includes("--require-head"),
    requireCleanScope: argv.includes("--require-clean-scope"),
  };
}

async function gitHead() {
  const { stdout } = await execFileAsync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: ROOT,
    windowsHide: true,
  });
  return stdout.trim();
}

async function main() {
  const options = optionsFromArgs(process.argv.slice(2));
  const baselinePath = join(ROOT, options.file);
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const result = validateQualityBaseline(baseline, {
    maxAgeHours: options.maxAgeHours,
    requireCleanScope: options.requireCleanScope,
  });
  const errors = [...result.errors];

  if (options.requireHead) {
    const head = await gitHead();
    if (baseline.git?.commit !== head) {
      errors.push(`baseline git commit is stale: ${baseline.git?.commit || "unknown"} != ${head}`);
    }
  }

  if (errors.length > 0) {
    console.error(`Quality baseline check failed for ${options.file}:`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log(`Quality baseline is fresh and complete: ${options.file}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
