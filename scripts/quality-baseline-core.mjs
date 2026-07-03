export const DEFAULT_OUTPUT = "docs/suggestions/evidence/current-quality-baseline.json";

export function outputPathFromArgs(argv) {
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

export function optionsFromArgs(argv) {
  return {
    outputPath: outputPathFromArgs(argv),
    requireClean: argv.includes("--require-clean"),
  };
}

export function numberMatch(output, pattern) {
  const match = output.match(pattern);
  return match ? Number(match[1]) : undefined;
}

export function parseNodeTestOutput(output) {
  return {
    tests: numberMatch(output, /\btests\s+(\d+)/),
    passed: numberMatch(output, /\bpass\s+(\d+)/),
    failed: numberMatch(output, /\bfail\s+(\d+)/),
  };
}

export function parseCoverageOutput(output) {
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

export function parseHttpSmokeOutput(output) {
  return {
    routes: numberMatch(output, /HTTP smoke passed for (\d+) route/),
  };
}

export function parseBrowserSmokeOutput(output) {
  return {
    passed: /Browser smoke passed\./.test(output),
  };
}

export function parseProductionOutput(output) {
  return {
    passedChecks: numberMatch(output, /通过:\s*(\d+)/),
    failedChecks: numberMatch(output, /失败:\s*(\d+)/),
    warnings: numberMatch(output, /警告:\s*(\d+)/),
  };
}

export function buildSummary(commands) {
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
