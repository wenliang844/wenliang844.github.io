import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSummary,
  commandLogFileName,
  logDirFromArgs,
  optionsFromArgs,
  outputTail,
  outputPathFromArgs,
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
  redactCommandOutput,
  validateQualityBaseline,
} from "../scripts/quality-baseline-core.mjs";

test("quality baseline argument parser supports output paths and clean mode", () => {
  assert.equal(outputPathFromArgs([]), "docs/suggestions/evidence/current-quality-baseline.json");
  assert.equal(outputPathFromArgs(["custom/baseline.json"]), "custom/baseline.json");
  assert.equal(outputPathFromArgs(["--out", "temp/baseline.json"]), "temp/baseline.json");
  assert.equal(outputPathFromArgs(["--log-dir", "temp/logs", "custom/baseline.json"]), "custom/baseline.json");
  assert.equal(logDirFromArgs([]), "temp/quality-baseline/logs");
  assert.equal(logDirFromArgs(["--log-dir", "temp/logs"]), "temp/logs");
  assert.deepEqual(optionsFromArgs(["--require-clean", "--out", "temp/baseline.json", "--log-dir", "temp/logs"]), {
    outputPath: "temp/baseline.json",
    logDir: "temp/logs",
    requireClean: true,
  });
  assert.throws(() => outputPathFromArgs(["--out"]), /--out requires a file path/);
  assert.throws(() => logDirFromArgs(["--log-dir"]), /--log-dir requires a directory path/);
});

test("quality baseline failure log helpers sanitize paths and sensitive output", () => {
  assert.equal(commandLogFileName("browser smoke!"), "browser-smoke.log");
  assert.equal(commandLogFileName(""), "command.log");

  const redacted = redactCommandOutput([
    "Authorization: Bearer sk-secret",
    "api_key=abc123",
    "https://example.test/?token=secret-token&ok=1",
    "password: hunter2",
  ].join("\n"));

  assert.doesNotMatch(redacted, /sk-secret|abc123|secret-token|hunter2/);
  assert.match(redacted, /Authorization: Bearer \[REDACTED\]/);
  assert.match(outputTail(`prefix-${"x".repeat(20)}`, 10), /^x{10}$/);
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
  assert.deepEqual(parseHttpSmokeOutput("HTTP smoke (full) passed for 14 routes."), { routes: 14 });
  assert.deepEqual(parseBrowserSmokeOutput("Browser smoke passed."), { passed: true });
  assert.deepEqual(parseBrowserSmokeOutput("Browser smoke (critical) passed."), { passed: true });
  assert.deepEqual(
    parseI18nCoverageOutput([
      "i18n coverage checked 21 HTML files",
      "Required key references: 970",
      "Unique required keys: 263",
      "Missing English keys: 0",
    ].join("\n")),
    { checkedFiles: 21, requiredReferences: 970, uniqueRequiredKeys: 263, missingKeys: 0 },
  );
  assert.deepEqual(
    parsePwaSmokeOutput([
      "✓ uncached search index is unavailable while offline",
      "✓ cached search index is available offline",
      "✓ cached article shows offline reading status",
      "✓ uncached navigation falls back to /offline.html",
      "✓ network-only relay data is not served from cache while offline",
      "✓ service worker upgrade clears old CWL caches",
      "PWA smoke passed.",
    ].join("\n")),
    {
      passed: true,
      searchIndexUncached: true,
      searchIndexCached: true,
      articleOfflineStatus: true,
      offlineFallback: true,
      networkOnlyData: true,
      serviceWorkerUpgrade: true,
    },
  );
  assert.deepEqual(
    parseSeoFeedOutput([
      "HTML pages: 21",
      "Indexable pages: 19",
      "Sitemap URLs: 19",
      "RSS feeds: 3",
      "RSS items per feed: 6",
      "Feed alternates: 21",
      "JSON-LD blocks: 20",
      "Violations: 0",
      "SEO/feed check passed.",
    ].join("\n")),
    {
      htmlPages: 21,
      indexablePages: 19,
      sitemapUrls: 19,
      rssFeeds: 3,
      rssItemsPerFeed: 6,
      feedAlternates: 21,
      jsonLdBlocks: 20,
      violations: 0,
      passed: true,
    },
  );
  assert.deepEqual(
    parsePwaPrecacheOutput([
      "PWA precache URLs: 19",
      "Service worker precache URLs: 19",
      "Missing files: 0",
      "Managed precache URL gaps: 0",
      "Missing from service worker: 0",
      "Extra in service worker: 0",
      "Uncacheable URLs: 0",
      "Font URLs covered: 2",
      "Page asset URLs covered: 2",
      "Missing page asset URLs: 0",
      "PWA precache check passed.",
    ].join("\n")),
    {
      urls: 19,
      serviceWorkerUrls: 19,
      missingFiles: 0,
      unmanagedUrls: 0,
      missingFromServiceWorker: 0,
      extraInServiceWorker: 0,
      uncacheableUrls: 0,
      fontUrlsCovered: 2,
      pageAssetUrlsCovered: 2,
      missingPageAssetUrls: 0,
      passed: true,
    },
  );
  assert.deepEqual(
    parseServiceWorkerGenerationOutput("Service worker generation check passed for service-worker.js."),
    { passed: true },
  );
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

function validBaseline(overrides = {}) {
  return {
    generatedAt: "2026-07-03T22:20:35.137Z",
    scope: "working-tree",
    git: {
      branch: "codex/autonomous-optimization",
      commit: "7878fd2",
      dirty: true,
      status: [" M package.json"],
    },
    summary: {
      status: "pass",
      commands: { total: 14, passed: 14, failed: 0 },
      tests: { total: 799, passed: 799, failed: 0 },
      coverage: { lines: 96.76, branches: 83.26, functions: 96.51 },
    },
    commands: [
      { id: "lint", command: "npm run lint:check", purpose: "release-gate", status: "pass", warnings: 0 },
      { id: "test", command: "npm test", purpose: "release-gate", status: "pass", tests: 799, passed: 799, failed: 0 },
      { id: "vendor-manifest", command: "npm run check:vendor", purpose: "release-gate", status: "pass" },
      { id: "generated-drift", command: "npm run check:generated", purpose: "release-gate", status: "pass" },
      {
        id: "i18n-coverage",
        command: "npm run check:i18n",
        purpose: "release-gate",
        status: "pass",
        checkedFiles: 21,
        requiredReferences: 970,
        uniqueRequiredKeys: 263,
        missingKeys: 0,
      },
      {
        id: "seo-feed",
        command: "npm run check:seo-feed",
        purpose: "release-gate",
        status: "pass",
        htmlPages: 21,
        indexablePages: 19,
        sitemapUrls: 19,
        rssFeeds: 3,
        rssItemsPerFeed: 6,
        feedAlternates: 21,
        jsonLdBlocks: 20,
        violations: 0,
        passed: true,
      },
      {
        id: "service-worker-generation",
        command: "npm run check:service-worker",
        purpose: "release-gate",
        status: "pass",
        passed: true,
      },
      {
        id: "coverage",
        command: "npm run test:coverage",
        purpose: "release-gate",
        status: "pass",
        tests: 799,
        passed: 799,
        failed: 0,
        coverage: { lines: 96.76, branches: 83.26, functions: 96.51 },
      },
      {
        id: "pwa-precache",
        command: "npm run check:pwa-precache",
        purpose: "release-gate",
        status: "pass",
        urls: 18,
        serviceWorkerUrls: 18,
        missingFiles: 0,
        unmanagedUrls: 0,
        missingFromServiceWorker: 0,
        extraInServiceWorker: 0,
        uncacheableUrls: 0,
        fontUrlsCovered: 2,
        pageAssetUrlsCovered: 2,
        missingPageAssetUrls: 0,
        passed: true,
      },
      {
        id: "suggestions-index",
        command: "npm run check:suggestions-index",
        purpose: "release-gate",
        status: "pass",
      },
      { id: "http-smoke", command: "npm run test:http-smoke", purpose: "release-gate", status: "pass", routes: 7 },
      { id: "browser-smoke", command: "npm run test:browser-smoke", purpose: "browser-smoke", status: "pass", passed: true },
      {
        id: "pwa-smoke",
        command: "npm run test:pwa-smoke",
        purpose: "browser-smoke",
        status: "pass",
        passed: true,
        searchIndexUncached: true,
        searchIndexCached: true,
        articleOfflineStatus: true,
        offlineFallback: true,
        networkOnlyData: true,
        serviceWorkerUpgrade: true,
      },
      {
        id: "production",
        command: "npm run validate:production",
        purpose: "release-gate",
        status: "pass",
        warnings: 0,
        passedChecks: 35,
        failedChecks: 0,
      },
    ],
    ...overrides,
  };
}

test("quality baseline validator accepts fresh complete artifacts", () => {
  assert.deepEqual(
    validateQualityBaseline(validBaseline(), { now: new Date("2026-07-04T00:00:00.000Z") }),
    { ok: true, errors: [] },
  );

  assert.deepEqual(
    validateQualityBaseline(
      validBaseline({
        scope: "clean-commit",
        git: {
          branch: "codex/autonomous-optimization",
          commit: "7878fd2",
          dirty: false,
          status: [],
        },
      }),
      { now: new Date("2026-07-04T00:00:00.000Z"), requireCleanScope: true },
    ),
    { ok: true, errors: [] },
  );
});

test("quality baseline validator rejects stale and incomplete artifacts", () => {
  const stale = validateQualityBaseline(validBaseline(), {
    now: new Date("2026-07-20T00:00:00.000Z"),
    maxAgeHours: 24,
  });
  assert.equal(stale.ok, false);
  assert.ok(stale.errors.some((error) => error.includes("older than 24 hours")));

  const incomplete = validateQualityBaseline(
    validBaseline({
      summary: {
        status: "pass",
        commands: { total: 13, passed: 13, failed: 0 },
        tests: { total: 799, passed: 799, failed: 0 },
        coverage: { lines: 96.76, branches: 83.26, functions: 96.51 },
      },
      commands: validBaseline().commands.filter((command) => command.id !== "browser-smoke"),
    }),
    { now: new Date("2026-07-04T00:00:00.000Z") },
  );
  assert.equal(incomplete.ok, false);
  assert.ok(incomplete.errors.includes("missing required command: browser-smoke"));
});

test("quality baseline validator rejects passing commands with missing parsed metrics", () => {
  const baseline = validBaseline({
    commands: validBaseline().commands.map((command) =>
      command.id === "coverage" ? { ...command, coverage: { lines: 96.76, branches: 83.26 } } : command,
    ),
  });

  const result = validateQualityBaseline(baseline, { now: new Date("2026-07-04T00:00:00.000Z") });

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("coverage.coverage.functions must be a finite number"));
});

test("quality baseline validator requires failure log evidence for failed commands", () => {
  const failedWithoutLog = validBaseline({
    summary: {
      status: "fail",
      commands: { total: 14, passed: 13, failed: 1 },
      tests: { total: 799, passed: 798, failed: 1 },
      coverage: { lines: 96.76, branches: 83.26, functions: 96.51 },
    },
    commands: validBaseline().commands.map((command) =>
      command.id === "test" ? { ...command, status: "fail", failed: 1, error: "test failed" } : command,
    ),
  });

  const result = validateQualityBaseline(failedWithoutLog, { now: new Date("2026-07-04T00:00:00.000Z") });

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("summary.status must be pass"));
  assert.ok(result.errors.includes("test failed command must include logPath"));
  assert.ok(result.errors.includes("test failed command must include outputTail"));

  const failedWithLog = validateQualityBaseline({
    ...failedWithoutLog,
    commands: failedWithoutLog.commands.map((command) =>
      command.id === "test"
        ? { ...command, logPath: "temp/quality-baseline/logs/test.log", outputTail: "not ok 1" }
        : command,
    ),
  }, { now: new Date("2026-07-04T00:00:00.000Z") });

  assert.equal(failedWithLog.errors.includes("test failed command must include logPath"), false);
  assert.equal(failedWithLog.errors.includes("test failed command must include outputTail"), false);
});

test("quality baseline validator rejects dirty artifacts when clean scope is required", () => {
  const result = validateQualityBaseline(validBaseline(), {
    now: new Date("2026-07-04T00:00:00.000Z"),
    requireCleanScope: true,
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("scope must be clean-commit when clean scope is required"));
  assert.ok(result.errors.includes("git.dirty must be false when clean scope is required"));
});
