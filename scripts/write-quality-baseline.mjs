#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const IS_WINDOWS = process.platform === "win32";
const OUTPUT_MAX_BUFFER = 32 * 1024 * 1024;
const DEFAULT_OUTPUT = "docs/suggestions/evidence/current-quality-baseline.json";

const COMMANDS = [
  { id: "lint", command: "npm", args: ["run", "lint:check"], purpose: "release-gate" },
  { id: "test", command: "npm", args: ["test"], purpose: "release-gate", parser: parseNodeTestOutput },
  { id: "coverage", command: "npm", args: ["run", "test:coverage"], purpose: "release-gate", parser: parseCoverageOutput },
  { id: "http-smoke", command: "npm", args: ["run", "test:http-smoke"], purpose: "release-gate", parser: parseHttpSmokeOutput },
  { id: "browser-smoke", command: "npm", args: ["run", "test:browser-smoke"], purpose: "browser-smoke", parser: parseBrowserSmokeOutput },
  { id: "production", command: "npm", args: ["run", "validate:production"], purpose: "release-gate", parser: parseProductionOutput },
];

function outputPathFromArgs(argv) {
  const outIndex = argv.indexOf("--out");
  if (outIndex !== -1) {
    const value = argv[outIndex + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("--out requires a file path");
    }
    return value;
  }

  const positionalOutput = argv.find((value) => value && !value.startsWith("--"));
  return positionalOutput || DEFAULT_OUTPUT;
}

function commandString({ command, args }) {
  return [command, ...args].join(" ");
}

function numberMatch(output, pattern) {
  const match = output.match(pattern);
  return match ? Number(match[1]) : undefined;
}

function parseNodeTestOutput(output) {
  return {
    tests: numberMatch(output, /\btests\s+(\d+)/),
    passed: numberMatch(output, /\bpass\s+(\d+)/),
    failed: numberMatch(output, /\bfail\s+(\d+)/),
  };
}

function parseCoverageOutput(output) {
  const stats = parseNodeTestOutput(output);
  const coverageMatch = output.match(/all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
  if (coverageMatch) {
    stats.coverage = {
      lines: Number(coverageMatch[1]),
      branches: Number(coverageMatch[2]),
      functions: Number(coverageMatch[3]),
    };
  }
  return stats;
}

function parseHttpSmokeOutput(output) {
  return {
    routes: numberMatch(output, /HTTP smoke passed for (\d+) route/),
  };
}

function parseBrowserSmokeOutput(output) {
  return {
    passed: /Browser smoke passed\./.test(output),
  };
}

function parseProductionOutput(output) {
  return {
    passedChecks: numberMatch(output, /通过:\s*(\d+)/),
    failedChecks: numberMatch(output, /失败:\s*(\d+)/),
    warnings: numberMatch(output, /警告:\s*(\d+)/),
  };
}

async function run(command, args, options = {}) {
  try {
    const startedAt = Date.now();
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: ROOT,
      windowsHide: true,
      shell: IS_WINDOWS && command === "npm",
      maxBuffer: OUTPUT_MAX_BUFFER,
      ...options,
    });
    return {
      ok: true,
      durationMs: Date.now() - startedAt,
      output: `${stdout || ""}${stderr || ""}`,
    };
  } catch (error) {
    return {
      ok: false,
      durationMs: undefined,
      output: `${error.stdout || ""}${error.stderr || ""}`,
      error: error.message,
    };
  }
}

async function gitInfo() {
  const [branch, commit, status] = await Promise.all([
    run("git", ["branch", "--show-current"]),
    run("git", ["rev-parse", "--short", "HEAD"]),
    run("git", ["status", "--porcelain", "--untracked-files=all"]),
  ]);
  const statusLines = status.output.trim().split(/\r?\n/).filter(Boolean);
  const untrackedFiles = statusLines
    .filter((line) => line.startsWith("?? "))
    .map((line) => line.slice(3));
  return {
    branch: branch.output.trim() || null,
    commit: commit.output.trim() || null,
    dirty: statusLines.length > 0,
    untrackedFileCount: untrackedFiles.length,
    untrackedFiles,
    status: statusLines,
  };
}

async function runQualityCommands() {
  const results = [];
  for (const item of COMMANDS) {
    console.log(`Running ${commandString(item)}...`);
    const result = await run(item.command, item.args);
    const parsed = item.parser ? item.parser(result.output) : {};
    const warnings = item.id === "lint" ? numberMatch(result.output, /(\d+)\s+warning/) ?? 0 : parsed.warnings;
    results.push({
      id: item.id,
      command: commandString(item),
      purpose: item.purpose,
      status: result.ok ? "pass" : "fail",
      durationMs: result.durationMs,
      ...(warnings !== undefined ? { warnings } : {}),
      ...parsed,
      ...(result.error ? { error: result.error } : {}),
    });
  }
  return results;
}

function buildSummary(commands) {
  const failedCommands = commands.filter((item) => item.status !== "pass");
  const coverageCommand = commands.find((item) => item.id === "coverage");
  const testCommand = commands.find((item) => item.id === "test");
  return {
    status: failedCommands.length === 0 ? "pass" : "fail",
    commands: {
      total: commands.length,
      passed: commands.length - failedCommands.length,
      failed: failedCommands.length,
    },
    tests: {
      total: coverageCommand?.tests ?? testCommand?.tests ?? null,
      passed: coverageCommand?.passed ?? testCommand?.passed ?? null,
      failed: coverageCommand?.failed ?? testCommand?.failed ?? null,
    },
    coverage: coverageCommand?.coverage ?? null,
  };
}

async function main() {
  const outputPath = outputPathFromArgs(process.argv.slice(2));
  const commands = await runQualityCommands();
  const baseline = {
    generatedAt: new Date().toISOString(),
    scope: "working-tree",
    git: await gitInfo(),
    summary: buildSummary(commands),
    commands,
  };

  const absoluteOutput = join(ROOT, outputPath);
  await mkdir(dirname(absoluteOutput), { recursive: true });
  await writeFile(absoluteOutput, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Wrote ${outputPath}`);

  if (baseline.summary.status !== "pass") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
