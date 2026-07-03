import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSummary,
  optionsFromArgs,
  outputPathFromArgs,
  parseBrowserSmokeOutput,
  parseCoverageOutput,
  parseHttpSmokeOutput,
  parseNodeTestOutput,
  parseProductionOutput,
} from "../scripts/quality-baseline-core.mjs";

test("quality baseline argument parser supports output paths and clean mode", () => {
  assert.equal(outputPathFromArgs([]), "docs/suggestions/evidence/current-quality-baseline.json");
  assert.equal(outputPathFromArgs(["custom/baseline.json"]), "custom/baseline.json");
  assert.equal(outputPathFromArgs(["--out", "temp/baseline.json"]), "temp/baseline.json");
  assert.deepEqual(optionsFromArgs(["--require-clean", "--out", "temp/baseline.json"]), {
    outputPath: "temp/baseline.json",
    requireClean: true,
  });
  assert.throws(() => outputPathFromArgs(["--out"]), /--out requires a file path/);
});

test("quality baseline parsers read command output fixtures", () => {
  const nodeTestOutput = [
    "ok 1 - sample",
    "ℹ tests 789",
    "ℹ pass 789",
    "ℹ fail 0",
  ].join("\n");
  const coverageOutput = [
    nodeTestOutput,
    "ℹ all files                     |  96.76 |    83.95 |   96.30 |",
  ].join("\n");

  assert.deepEqual(parseNodeTestOutput(nodeTestOutput), { tests: 789, passed: 789, failed: 0 });
  assert.deepEqual(parseCoverageOutput(coverageOutput), {
    tests: 789,
    passed: 789,
    failed: 0,
    coverage: { lines: 96.76, branches: 83.95, functions: 96.3 },
  });
  assert.deepEqual(parseHttpSmokeOutput("HTTP smoke passed for 6 routes."), { routes: 6 });
  assert.deepEqual(parseBrowserSmokeOutput("Browser smoke passed."), { passed: true });
  assert.deepEqual(parseProductionOutput("通过: 34\n失败: 0\n警告: 0"), {
    passedChecks: 34,
    failedChecks: 0,
    warnings: 0,
  });
});

test("quality baseline summary prefers coverage totals", () => {
  assert.deepEqual(
    buildSummary([
      { id: "test", status: "pass", tests: 100, passed: 100, failed: 0 },
      {
        id: "coverage",
        status: "pass",
        tests: 101,
        passed: 101,
        failed: 0,
        coverage: { lines: 96.76, branches: 83.95, functions: 96.3 },
      },
    ]),
    {
      status: "pass",
      commands: { total: 2, passed: 2, failed: 0 },
      tests: { total: 101, passed: 101, failed: 0 },
      coverage: { lines: 96.76, branches: 83.95, functions: 96.3 },
    },
  );
});
