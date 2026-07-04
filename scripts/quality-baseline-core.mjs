export const DEFAULT_OUTPUT = "docs/suggestions/evidence/current-quality-baseline.json";
export const DEFAULT_BASELINE_MAX_AGE_HOURS = 168;
export const DEFAULT_FAILURE_LOG_DIR = "temp/quality-baseline/logs";
export const REQUIRED_BASELINE_COMMAND_IDS = [
  "lint",
  "test",
  "vendor-manifest",
  "generated-drift",
  "i18n-coverage",
  "seo-feed",
  "service-worker-generation",
  "pwa-precache",
  "suggestions-index",
  "coverage",
  "http-smoke",
  "browser-smoke",
  "pwa-smoke",
  "production",
];

export function outputPathFromArgs(argv) {
  const outIndex = argv.indexOf("--out");
  if (outIndex !== -1) {
    const value = argv[outIndex + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("--out requires a file path");
    }
    return value;
  }

  const skipNext = new Set();
  argv.forEach((value, index) => {
    if (value === "--out" || value === "--log-dir") {
      skipNext.add(index + 1);
    }
  });
  const positionalOutput = argv.find((value, index) => value && !value.startsWith("--") && !skipNext.has(index));
  return positionalOutput || DEFAULT_OUTPUT;
}

export function logDirFromArgs(argv) {
  const logDirIndex = argv.indexOf("--log-dir");
  if (logDirIndex !== -1) {
    const value = argv[logDirIndex + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("--log-dir requires a directory path");
    }
    return value;
  }
  return DEFAULT_FAILURE_LOG_DIR;
}

export function optionsFromArgs(argv) {
  return {
    outputPath: outputPathFromArgs(argv),
    logDir: logDirFromArgs(argv),
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
    routes: numberMatch(output, /HTTP smoke(?: \([^)]+\))? passed for (\d+) route/),
  };
}

export function parseBrowserSmokeOutput(output) {
  return {
    passed: /Browser smoke(?: \([^)]+\))? passed\./.test(output),
  };
}

export function parsePwaSmokeOutput(output) {
  return {
    passed: /PWA smoke passed\./.test(output),
    searchIndexUncached: /uncached search index is unavailable while offline/.test(output),
    searchIndexCached: /cached search index is available offline/.test(output),
    articleOfflineStatus: /cached article shows offline reading status/.test(output),
    offlineFallback: /uncached navigation falls back to \/offline\.html/.test(output),
    networkOnlyData: /network-only relay data is not served from cache while offline/.test(output),
    serviceWorkerUpgrade: /service worker upgrade clears old CWL caches/.test(output),
  };
}

export function parseI18nCoverageOutput(output) {
  return {
    checkedFiles: numberMatch(output, /i18n coverage checked (\d+) HTML file/),
    requiredReferences: numberMatch(output, /Required key references:\s*(\d+)/),
    uniqueRequiredKeys: numberMatch(output, /Unique required keys:\s*(\d+)/),
    missingKeys: numberMatch(output, /Missing English keys:\s*(\d+)/),
  };
}

export function parseSeoFeedOutput(output) {
  return {
    htmlPages: numberMatch(output, /HTML pages:\s*(\d+)/),
    indexablePages: numberMatch(output, /Indexable pages:\s*(\d+)/),
    sitemapUrls: numberMatch(output, /Sitemap URLs:\s*(\d+)/),
    rssFeeds: numberMatch(output, /RSS feeds:\s*(\d+)/),
    rssItemsPerFeed: numberMatch(output, /RSS items per feed:\s*(\d+)/),
    feedAlternates: numberMatch(output, /Feed alternates:\s*(\d+)/),
    jsonLdBlocks: numberMatch(output, /JSON-LD blocks:\s*(\d+)/),
    violations: numberMatch(output, /Violations:\s*(\d+)/),
    passed: /SEO\/feed check passed\./.test(output),
  };
}

export function parsePwaPrecacheOutput(output) {
  return {
    urls: numberMatch(output, /PWA precache URLs:\s*(\d+)/),
    serviceWorkerUrls: numberMatch(output, /Service worker precache URLs:\s*(\d+)/),
    missingFiles: numberMatch(output, /Missing files:\s*(\d+)/),
    unmanagedUrls: numberMatch(output, /Managed precache URL gaps:\s*(\d+)/),
    missingFromServiceWorker: numberMatch(output, /Missing from service worker:\s*(\d+)/),
    extraInServiceWorker: numberMatch(output, /Extra in service worker:\s*(\d+)/),
    uncacheableUrls: numberMatch(output, /Uncacheable URLs:\s*(\d+)/),
    fontUrlsCovered: numberMatch(output, /Font URLs covered:\s*(\d+)/),
    pageAssetUrlsCovered: numberMatch(output, /Page asset URLs covered:\s*(\d+)/),
    missingPageAssetUrls: numberMatch(output, /Missing page asset URLs:\s*(\d+)/),
    passed: /PWA precache check passed\./.test(output),
  };
}

export function parseServiceWorkerGenerationOutput(output) {
  return {
    passed: /Service worker generation check passed/.test(output),
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

export function commandLogFileName(commandId) {
  const safeId = String(commandId || "command")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safeId || "command"}.log`;
}

export function redactCommandOutput(output) {
  return String(output || "")
    .replace(/(authorization\s*[:=]\s*)(bearer\s+)?[^\s"'<>]+/gi, "$1$2[REDACTED]")
    .replace(/((?:api[_-]?key|access[_-]?token|secret|token|password)\s*[:=]\s*)[^\s"'<>]+/gi, "$1[REDACTED]")
    .replace(/([?&](?:api[_-]?key|access[_-]?token|token|secret|signature)=)[^&\s"'<>]+/gi, "$1[REDACTED]");
}

export function outputTail(output, maxLength = 4000) {
  const redacted = redactCommandOutput(output);
  return redacted.length > maxLength ? redacted.slice(-maxLength) : redacted;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function requireNumber(errors, value, path) {
  if (!isFiniteNumber(value)) {
    errors.push(`${path} must be a finite number`);
  }
}

function validateCommand(errors, command) {
  if (!isPlainObject(command)) {
    errors.push("commands entries must be objects");
    return;
  }

  if (typeof command.id !== "string" || command.id.length === 0) {
    errors.push("commands[].id must be a non-empty string");
  }
  if (command.status !== "pass") {
    errors.push(`${command.id || "unknown"} command status must be pass`);
  }
  if (typeof command.command !== "string" || command.command.length === 0) {
    errors.push(`${command.id || "unknown"} command must record the shell command`);
  }
  if (command.purpose === "release-gate" && command.status !== "pass") {
    errors.push(`${command.id || "unknown"} release gate did not pass`);
  }
  if (command.status !== "pass") {
    if (typeof command.logPath !== "string" || command.logPath.length === 0) {
      errors.push(`${command.id || "unknown"} failed command must include logPath`);
    }
    if (typeof command.outputTail !== "string") {
      errors.push(`${command.id || "unknown"} failed command must include outputTail`);
    }
  }

  if (command.id === "test" || command.id === "coverage") {
    requireNumber(errors, command.tests, `${command.id}.tests`);
    requireNumber(errors, command.passed, `${command.id}.passed`);
    requireNumber(errors, command.failed, `${command.id}.failed`);
  }
  if (command.id === "coverage") {
    requireNumber(errors, command.coverage?.lines, "coverage.coverage.lines");
    requireNumber(errors, command.coverage?.branches, "coverage.coverage.branches");
    requireNumber(errors, command.coverage?.functions, "coverage.coverage.functions");
  }
  if (command.id === "http-smoke") {
    requireNumber(errors, command.routes, "http-smoke.routes");
  }
  if (command.id === "browser-smoke" && command.passed !== true) {
    errors.push("browser-smoke.passed must be true");
  }
  if (command.id === "pwa-smoke") {
    if (command.passed !== true) {
      errors.push("pwa-smoke.passed must be true");
    }
    if (command.searchIndexUncached !== true) {
      errors.push("pwa-smoke.searchIndexUncached must be true");
    }
    if (command.searchIndexCached !== true) {
      errors.push("pwa-smoke.searchIndexCached must be true");
    }
    if (command.articleOfflineStatus !== true) {
      errors.push("pwa-smoke.articleOfflineStatus must be true");
    }
    if (command.offlineFallback !== true) {
      errors.push("pwa-smoke.offlineFallback must be true");
    }
    if (command.networkOnlyData !== true) {
      errors.push("pwa-smoke.networkOnlyData must be true");
    }
    if (command.serviceWorkerUpgrade !== true) {
      errors.push("pwa-smoke.serviceWorkerUpgrade must be true");
    }
  }
  if (command.id === "i18n-coverage") {
    requireNumber(errors, command.checkedFiles, "i18n-coverage.checkedFiles");
    requireNumber(errors, command.requiredReferences, "i18n-coverage.requiredReferences");
    requireNumber(errors, command.uniqueRequiredKeys, "i18n-coverage.uniqueRequiredKeys");
    if (command.missingKeys !== 0) {
      errors.push("i18n-coverage.missingKeys must be 0");
    }
  }
  if (command.id === "seo-feed") {
    requireNumber(errors, command.htmlPages, "seo-feed.htmlPages");
    requireNumber(errors, command.indexablePages, "seo-feed.indexablePages");
    requireNumber(errors, command.sitemapUrls, "seo-feed.sitemapUrls");
    requireNumber(errors, command.rssFeeds, "seo-feed.rssFeeds");
    requireNumber(errors, command.rssItemsPerFeed, "seo-feed.rssItemsPerFeed");
    requireNumber(errors, command.feedAlternates, "seo-feed.feedAlternates");
    requireNumber(errors, command.jsonLdBlocks, "seo-feed.jsonLdBlocks");
    if (command.violations !== 0) {
      errors.push("seo-feed.violations must be 0");
    }
    if (command.passed !== true) {
      errors.push("seo-feed.passed must be true");
    }
  }
  if (command.id === "pwa-precache") {
    requireNumber(errors, command.urls, "pwa-precache.urls");
    requireNumber(errors, command.serviceWorkerUrls, "pwa-precache.serviceWorkerUrls");
    requireNumber(errors, command.unmanagedUrls, "pwa-precache.unmanagedUrls");
    if (command.missingFiles !== 0) {
      errors.push("pwa-precache.missingFiles must be 0");
    }
    if (command.unmanagedUrls !== 0) {
      errors.push("pwa-precache.unmanagedUrls must be 0");
    }
    if (command.missingFromServiceWorker !== 0) {
      errors.push("pwa-precache.missingFromServiceWorker must be 0");
    }
    if (command.extraInServiceWorker !== 0) {
      errors.push("pwa-precache.extraInServiceWorker must be 0");
    }
    if (command.uncacheableUrls !== 0) {
      errors.push("pwa-precache.uncacheableUrls must be 0");
    }
    requireNumber(errors, command.fontUrlsCovered, "pwa-precache.fontUrlsCovered");
    requireNumber(errors, command.pageAssetUrlsCovered, "pwa-precache.pageAssetUrlsCovered");
    requireNumber(errors, command.missingPageAssetUrls, "pwa-precache.missingPageAssetUrls");
    if (command.missingPageAssetUrls !== 0) {
      errors.push("pwa-precache.missingPageAssetUrls must be 0");
    }
    if (command.passed !== true) {
      errors.push("pwa-precache.passed must be true");
    }
  }
  if (command.id === "service-worker-generation" && command.passed !== true) {
    errors.push("service-worker-generation.passed must be true");
  }
  if (command.id === "production") {
    requireNumber(errors, command.passedChecks, "production.passedChecks");
    if (command.failedChecks !== 0) {
      errors.push("production.failedChecks must be 0");
    }
  }
}

export function validateQualityBaseline(
  baseline,
  {
    now = new Date(),
    maxAgeHours = DEFAULT_BASELINE_MAX_AGE_HOURS,
    requiredCommandIds = REQUIRED_BASELINE_COMMAND_IDS,
    requireCleanScope = false,
  } = {},
) {
  const errors = [];
  if (!isPlainObject(baseline)) {
    return { ok: false, errors: ["baseline must be a JSON object"] };
  }

  const generatedAt = new Date(baseline.generatedAt);
  if (Number.isNaN(generatedAt.getTime())) {
    errors.push("generatedAt must be a valid ISO timestamp");
  } else {
    const ageMs = now.getTime() - generatedAt.getTime();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    if (ageMs < -5 * 60 * 1000) {
      errors.push("generatedAt must not be in the future");
    }
    if (ageMs > maxAgeMs) {
      errors.push(`baseline is stale: generatedAt is older than ${maxAgeHours} hours`);
    }
  }

  if (!["working-tree", "clean-commit"].includes(baseline.scope)) {
    errors.push("scope must be working-tree or clean-commit");
  }
  if (requireCleanScope && baseline.scope !== "clean-commit") {
    errors.push("scope must be clean-commit when clean scope is required");
  }
  if (!isPlainObject(baseline.git)) {
    errors.push("git must be an object");
  } else {
    if (typeof baseline.git.branch !== "string" || baseline.git.branch.length === 0) {
      errors.push("git.branch must be a non-empty string");
    }
    if (typeof baseline.git.commit !== "string" || baseline.git.commit.length === 0) {
      errors.push("git.commit must be a non-empty string");
    }
    if (typeof baseline.git.dirty !== "boolean") {
      errors.push("git.dirty must be a boolean");
    }
    if (requireCleanScope && baseline.git.dirty !== false) {
      errors.push("git.dirty must be false when clean scope is required");
    }
    if (!Array.isArray(baseline.git.status)) {
      errors.push("git.status must be an array");
    }
  }

  if (!isPlainObject(baseline.summary)) {
    errors.push("summary must be an object");
  } else {
    if (baseline.summary.status !== "pass") {
      errors.push("summary.status must be pass");
    }
    requireNumber(errors, baseline.summary.commands?.total, "summary.commands.total");
    requireNumber(errors, baseline.summary.commands?.passed, "summary.commands.passed");
    if (baseline.summary.commands?.failed !== 0) {
      errors.push("summary.commands.failed must be 0");
    }
    requireNumber(errors, baseline.summary.tests?.total, "summary.tests.total");
    requireNumber(errors, baseline.summary.tests?.passed, "summary.tests.passed");
    if (baseline.summary.tests?.failed !== 0) {
      errors.push("summary.tests.failed must be 0");
    }
    requireNumber(errors, baseline.summary.coverage?.lines, "summary.coverage.lines");
    requireNumber(errors, baseline.summary.coverage?.branches, "summary.coverage.branches");
    requireNumber(errors, baseline.summary.coverage?.functions, "summary.coverage.functions");
  }

  if (!Array.isArray(baseline.commands)) {
    errors.push("commands must be an array");
  } else {
    const ids = new Set(baseline.commands.map((command) => command?.id));
    requiredCommandIds.forEach((id) => {
      if (!ids.has(id)) {
        errors.push(`missing required command: ${id}`);
      }
    });
    if (baseline.summary?.commands?.total !== undefined && baseline.summary.commands.total !== baseline.commands.length) {
      errors.push("summary.commands.total must match commands.length");
    }
    baseline.commands.forEach((command) => validateCommand(errors, command));
  }

  return { ok: errors.length === 0, errors };
}
