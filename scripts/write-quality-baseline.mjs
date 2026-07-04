#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import {
  buildSummary,
  commandLogFileName,
  numberMatch,
  optionsFromArgs,
  parseBrowserSmokeOutput,
  parseCoverageOutput,
  parseHttpSmokeOutput,
  parseI18nCoverageOutput,
  parseNodeTestOutput,
  parsePwaPrecacheOutput,
  parsePwaSmokeOutput,
  parseProductionOutput,
  parseServiceWorkerGenerationOutput,
  parseSeoFeedOutput,
  outputTail,
  redactCommandOutput,
} from "./quality-baseline-core.mjs";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const IS_WINDOWS = process.platform === "win32";
const OUTPUT_MAX_BUFFER = 32 * 1024 * 1024;

const COMMANDS = [
  { id: "lint", command: "npm", args: ["run", "lint:check"], purpose: "release-gate" },
  { id: "test", command: "npm", args: ["test"], purpose: "release-gate", parser: parseNodeTestOutput },
  { id: "vendor-manifest", command: "npm", args: ["run", "check:vendor"], purpose: "release-gate" },
  { id: "generated-drift", command: "npm", args: ["run", "check:generated"], purpose: "release-gate" },
  { id: "i18n-coverage", command: "npm", args: ["run", "check:i18n"], purpose: "release-gate", parser: parseI18nCoverageOutput },
  { id: "seo-feed", command: "npm", args: ["run", "check:seo-feed"], purpose: "release-gate", parser: parseSeoFeedOutput },
  { id: "service-worker-generation", command: "npm", args: ["run", "check:service-worker"], purpose: "release-gate", parser: parseServiceWorkerGenerationOutput },
  { id: "pwa-precache", command: "npm", args: ["run", "check:pwa-precache"], purpose: "release-gate", parser: parsePwaPrecacheOutput },
  { id: "suggestions-index", command: "npm", args: ["run", "check:suggestions-index"], purpose: "release-gate" },
  { id: "coverage", command: "npm", args: ["run", "test:coverage"], purpose: "release-gate", parser: parseCoverageOutput },
  { id: "http-smoke", command: "npm", args: ["run", "test:http-smoke"], purpose: "release-gate", parser: parseHttpSmokeOutput },
  { id: "browser-smoke", command: "npm", args: ["run", "test:browser-smoke"], purpose: "browser-smoke", parser: parseBrowserSmokeOutput },
  { id: "pwa-smoke", command: "npm", args: ["run", "test:pwa-smoke"], purpose: "browser-smoke", parser: parsePwaSmokeOutput },
  { id: "production", command: "npm", args: ["run", "validate:production"], purpose: "release-gate", parser: parseProductionOutput },
];

function commandString({ command, args }) {
  return [command, ...args].join(" ");
}

function toPosixPath(path) {
  return path.replace(/\\/g, "/");
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

async function writeFailureLog({ item, result, logDir }) {
  const absoluteLogDir = join(ROOT, logDir);
  await mkdir(absoluteLogDir, { recursive: true });
  const logPath = join(absoluteLogDir, commandLogFileName(item.id));
  const logBody = [
    `command: ${commandString(item)}`,
    `status: fail`,
    `durationMs: ${result.durationMs ?? ""}`,
    `error: ${result.error || ""}`,
    "",
    redactCommandOutput(result.output),
  ].join("\n");
  await writeFile(logPath, `${logBody.replace(/\s+$/, "")}\n`);
  return toPosixPath(relative(ROOT, logPath));
}

function failureArtifactPaths(item) {
  if (item.id === "browser-smoke") {
    return ["temp/browser-smoke/"];
  }
  return [];
}

async function runQualityCommands({ logDir }) {
  const results = [];
  for (const item of COMMANDS) {
    console.log(`Running ${commandString(item)}...`);
    const result = await run(item.command, item.args);
    const parsed = item.parser ? item.parser(result.output) : {};
    const warnings = item.id === "lint" ? numberMatch(result.output, /(\d+)\s+warning/) ?? 0 : parsed.warnings;
    const failureLogPath = result.ok ? undefined : await writeFailureLog({ item, result, logDir });
    const artifactPaths = result.ok ? [] : failureArtifactPaths(item);
    results.push({
      id: item.id,
      command: commandString(item),
      purpose: item.purpose,
      status: result.ok ? "pass" : "fail",
      durationMs: result.durationMs,
      ...(warnings !== undefined ? { warnings } : {}),
      ...parsed,
      ...(failureLogPath ? { logPath: failureLogPath, outputTail: outputTail(result.output) } : {}),
      ...(artifactPaths.length ? { artifactPaths } : {}),
      ...(result.error ? { error: result.error } : {}),
    });
  }
  return results;
}

async function main() {
  const { outputPath, logDir, requireClean } = optionsFromArgs(process.argv.slice(2));
  const git = await gitInfo();
  if (requireClean && git.dirty) {
    throw new Error(`Quality baseline requires a clean worktree:\n${git.status.join("\n")}`);
  }

  const commands = await runQualityCommands({ logDir });
  const baseline = {
    generatedAt: new Date().toISOString(),
    scope: requireClean ? "clean-commit" : "working-tree",
    git,
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

function isDirectRun() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isDirectRun()) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  buildSummary,
  commandLogFileName,
  optionsFromArgs,
  parseBrowserSmokeOutput,
  parseCoverageOutput,
  parseHttpSmokeOutput,
  parseI18nCoverageOutput,
  parseNodeTestOutput,
  parsePwaPrecacheOutput,
  parsePwaSmokeOutput,
  parseProductionOutput,
  parseServiceWorkerGenerationOutput,
  parseSeoFeedOutput,
  outputTail,
  redactCommandOutput,
};
