#!/usr/bin/env node
// Parse a CC Switch SQLite SQL export into a sanitized relay-provider ranking.
//
// Usage:
//   node scripts/parse-relay.mjs <sql-file>
//   node scripts/parse-relay.mjs <sql-file> --out data/relay-providers.json

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DEFAULT_OUT = join(ROOT, "data", "relay-providers.json");
const RECENT_LIMIT = 20;

const TABLES = [
  "providers",
  "provider_endpoints",
  "provider_health",
  "proxy_request_logs",
  "stream_check_logs",
];

function parseArgs(argv) {
  const args = argv.slice(2);
  const sqlPath = args.find((arg, index) => arg && !arg.startsWith("--") && args[index - 1] !== "--out");
  const outIdx = args.indexOf("--out");
  const outPath = outIdx >= 0 ? args[outIdx + 1] : DEFAULT_OUT;

  if (!sqlPath || !outPath || outPath.startsWith("--")) {
    throw new Error("用法: node scripts/parse-relay.mjs <sql-file> [--out data/relay-providers.json]");
  }

  const resolvedOut = resolve(ROOT, outPath);
  const rel = relative(ROOT, resolvedOut);
  if (rel && (rel.startsWith("..") || isAbsolute(rel))) {
    throw new Error("--out 只能写入项目内路径。");
  }

  return {
    sqlPath,
    outPath: resolvedOut,
  };
}

function findStatementEnd(sql, start) {
  let quote = false;
  for (let i = start; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") {
      if (quote && sql[i + 1] === "'") {
        i++;
      } else {
        quote = !quote;
      }
    } else if (ch === ";" && !quote) {
      return i;
    }
  }
  return sql.length;
}

function extractInsertStatements(sql, tableName) {
  const needle = `INSERT INTO "${tableName}"`;
  const statements = [];
  let start = sql.indexOf(needle);

  while (start !== -1) {
    const end = findStatementEnd(sql, start);
    statements.push(sql.slice(start, end + 1));
    start = sql.indexOf(needle, end + 1);
  }

  return statements;
}

function parseColumns(statement) {
  const match = /^INSERT INTO\s+"[^"]+"\s+\(([\s\S]*?)\)\s+VALUES/i.exec(statement);
  if (!match) {
    return [];
  }
  return match[1].split(",").map((column) => column.trim().replace(/^"|"$/g, ""));
}

function parseValueToken(token) {
  const value = token.trim();
  if (!value || /^NULL$/i.test(value)) {
    return null;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }
  return value;
}

function parseValues(statement) {
  const marker = " VALUES ";
  const markerIndex = statement.toUpperCase().indexOf(marker);
  if (markerIndex === -1) {
    return [];
  }

  let values = statement.slice(markerIndex + marker.length).trim();
  if (values.endsWith(";")) {
    values = values.slice(0, -1).trim();
  }
  if (values.startsWith("(") && values.endsWith(")")) {
    values = values.slice(1, -1);
  }

  const parsed = [];
  let token = "";
  let quote = false;

  for (let i = 0; i < values.length; i++) {
    const ch = values[i];
    if (quote) {
      if (ch === "'" && values[i + 1] === "'") {
        token += "'";
        i++;
      } else if (ch === "'") {
        quote = false;
      } else {
        token += ch;
      }
      continue;
    }

    if (ch === "'") {
      quote = true;
      continue;
    }
    if (ch === ",") {
      parsed.push(parseValueToken(token));
      token = "";
      continue;
    }
    token += ch;
  }
  parsed.push(parseValueToken(token));
  return parsed;
}

function parseTable(sql, tableName) {
  return extractInsertStatements(sql, tableName).map((statement) => {
    const columns = parseColumns(statement);
    const values = parseValues(statement);
    const row = {};
    columns.forEach((column, index) => {
      row[column] = index < values.length ? values[index] : null;
    });
    return row;
  });
}

function safeJson(value) {
  if (!value || typeof value !== "string") {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function routeFormat(provider) {
  const meta = safeJson(provider.meta);
  const apiFormat = String(meta.apiFormat || "").toLowerCase();
  const appType = String(provider.app_type || "").toLowerCase();

  if (apiFormat.includes("anthropic") || appType.includes("claude")) {
    return "claude";
  }
  if (apiFormat.includes("openai") || apiFormat.includes("responses") || appType.includes("codex")) {
    return "chatgpt";
  }
  return appType.includes("claude") ? "claude" : "chatgpt";
}

function normalizeFormatLabel(format) {
  return format === "claude" ? "Claude/Anthropic" : "ChatGPT/OpenAI";
}

function normalizeEndpoint(url, format) {
  const value = String(url || "").trim();
  if (!value) {
    return "";
  }
  try {
    const parsed = new URL(value);
    parsed.search = "";
    parsed.hash = "";
    let clean = parsed.toString().replace(/\/$/, "");
    if (format === "chatgpt" && clean.endsWith("/v1/responses")) {
      clean = clean.replace(/\/responses$/, "");
    }
    return clean;
  } catch {
    return value.replace(/[?#].*$/, "").replace(/\/$/, "");
  }
}

function sanitizeWebsite(url) {
  const value = String(url || "").trim();
  if (!value) {
    return null;
  }
  try {
    const parsed = new URL(value);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return value.replace(/[?#].*$/, "").replace(/\/$/, "") || null;
  }
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toIsoTime(value) {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "number") {
    const ms = value > 100000000000 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function endpointKey(providerId, appType) {
  return `${providerId}::${appType}`;
}

function groupedKey(providerId, format) {
  return `${providerId}::${format}`;
}

function summarizeFailure(entry) {
  if (!entry) {
    return "";
  }

  const status = toNumber(entry.http_status ?? entry.status_code, 0);
  const message = String(entry.message || entry.error || "");
  const lower = message.toLowerCase();

  if (status === 401 || status === 403 || /auth|unauthorized|forbidden|access denied/.test(lower)) {
    return "鉴权失败或权限不足";
  }
  if (status === 429 || /rate limited|too many/.test(lower)) {
    return "频率限制";
  }
  if (status === 404 || /not found/.test(lower)) {
    return "路径或模型不可用";
  }
  if (status === 400 || /bad request/.test(lower)) {
    return "请求格式可能不匹配";
  }
  if (status === 503 || status === 502 || status === 504 || /timeout|unavailable|connection failed/.test(lower)) {
    return "服务不可用或超时";
  }
  if (status >= 500) {
    return "服务端错误";
  }
  return "最近测速失败";
}

function warningTags(name) {
  const text = String(name || "");
  return ["需要签到", "不稳定", "额度少", "慢"].filter((tag) => text.includes(tag));
}

function healthFrom(group, recentChecks) {
  const latestCheck = recentChecks[0];
  if (latestCheck) {
    if (latestCheck.success) {
      return latestCheck.status === "degraded" ? "degraded" : "healthy";
    }
    return "down";
  }

  if (group.healthRows.length) {
    const latest = group.healthRows[0];
    if (toNumber(latest.is_healthy, 0) === 1) {
      return "healthy";
    }
    return toNumber(latest.consecutive_failures, 0) > 1 ? "down" : "degraded";
  }

  return "unknown";
}

function freshnessScore(lastTestedAt, now) {
  if (!lastTestedAt) {
    return 5;
  }
  const ageDays = Math.max(0, (now.getTime() - new Date(lastTestedAt).getTime()) / 86400000);
  if (ageDays <= 1) return 10;
  if (ageDays <= 7) return 8;
  if (ageDays <= 30) return 5;
  return 2;
}

function speedScore(latencyMs) {
  if (!latencyMs) {
    return 7;
  }
  if (latencyMs <= 800) {
    return 15;
  }
  if (latencyMs <= 2000) {
    return 15 - ((latencyMs - 800) / 1200) * 5;
  }
  if (latencyMs <= 8000) {
    return 10 - ((latencyMs - 2000) / 6000) * 6;
  }
  return 1;
}

function healthScore(status, failures) {
  if (status === "healthy") return 40;
  if (status === "degraded") return 26;
  if (status === "unknown") return 20;
  return Math.max(0, 14 - failures * 2);
}

function failurePenalty(recentChecks) {
  const failures = recentChecks.filter((item) => !item.success);
  if (!failures.length) {
    return 0;
  }

  const failureRate = failures.length / recentChecks.length;
  const statuses = failures.map((item) => toNumber(item.http_status, 0));
  if (statuses.some((status) => status === 401 || status === 403)) {
    return 15;
  }
  if (statuses.some((status) => status === 429)) {
    return 8;
  }
  if (statuses.some((status) => status === 503 || status === 502 || status === 504 || status === 0)) {
    return Math.round(4 + failureRate * 6);
  }
  if (statuses.some((status) => status >= 500)) {
    return 6;
  }
  return Math.round(2 + failureRate * 4);
}

function buildScore(group, details) {
  const maxSort = Math.max(1, details.maxSortIndex);
  const manual = group.isCurrent
    ? 5
    : Math.max(0, 5 - (toNumber(group.sortIndex, maxSort) / maxSort) * 5);
  const success = details.successRate == null ? 15 : (details.successRate / 100) * 30;
  const total = healthScore(details.healthStatus, details.consecutiveFailures)
    + success
    + speedScore(details.latencyMs)
    + freshnessScore(details.lastTestedAt, details.now)
    + manual
    - details.penalty;

  return Math.max(0, Math.min(100, Math.round(total)));
}

function average(values) {
  const nums = values.map((value) => toNumber(value, NaN)).filter(Number.isFinite);
  if (!nums.length) {
    return null;
  }
  return Math.round(nums.reduce((sum, value) => sum + value, 0) / nums.length);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function buildRelayRows(tables, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const endpointMap = new Map();
  const healthMap = new Map();
  const streamMap = new Map();
  const requestMap = new Map();
  const groups = new Map();

  for (const endpoint of tables.provider_endpoints || []) {
    const key = endpointKey(endpoint.provider_id, endpoint.app_type);
    if (!endpointMap.has(key)) {
      endpointMap.set(key, []);
    }
    endpointMap.get(key).push(endpoint);
  }

  for (const health of tables.provider_health || []) {
    const key = endpointKey(health.provider_id, health.app_type);
    if (!healthMap.has(key)) {
      healthMap.set(key, []);
    }
    healthMap.get(key).push(health);
  }
  for (const rows of healthMap.values()) {
    rows.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  }

  for (const check of tables.stream_check_logs || []) {
    const format = String(check.app_type || "").includes("claude") ? "claude" : "chatgpt";
    const key = groupedKey(check.provider_id, format);
    if (!streamMap.has(key)) {
      streamMap.set(key, []);
    }
    streamMap.get(key).push({
      ...check,
      success: toNumber(check.success, 0) === 1,
      tested_at: toNumber(check.tested_at, 0),
    });
  }
  for (const rows of streamMap.values()) {
    rows.sort((a, b) => toNumber(b.tested_at, 0) - toNumber(a.tested_at, 0));
  }

  for (const log of tables.proxy_request_logs || []) {
    const format = String(log.app_type || "").includes("claude") ? "claude" : "chatgpt";
    const key = groupedKey(log.provider_id, format);
    if (!requestMap.has(key)) {
      requestMap.set(key, []);
    }
    requestMap.get(key).push(log);
  }

  for (const provider of tables.providers || []) {
    if (provider.category === "official") {
      continue;
    }
    const format = routeFormat(provider);
    const key = groupedKey(provider.id, format);
    if (!groups.has(key)) {
      groups.set(key, {
        name: provider.name,
        format,
        appTypes: new Set(),
        endpoints: [],
        websiteUrl: sanitizeWebsite(provider.website_url),
        models: [],
        healthRows: [],
        isCurrent: false,
        sortIndex: Number.POSITIVE_INFINITY,
        createdAt: provider.created_at,
      });
    }

    const group = groups.get(key);
    group.appTypes.add(provider.app_type);
    group.name = group.name || provider.name;
    group.websiteUrl = group.websiteUrl || sanitizeWebsite(provider.website_url);
    group.isCurrent = group.isCurrent || toNumber(provider.is_current, 0) === 1;
    group.sortIndex = Math.min(group.sortIndex, toNumber(provider.sort_index, Number.POSITIVE_INFINITY));

    const epRows = endpointMap.get(endpointKey(provider.id, provider.app_type)) || [];
    group.endpoints.push(...epRows.map((row) => normalizeEndpoint(row.url, format)));
    group.healthRows.push(...(healthMap.get(endpointKey(provider.id, provider.app_type)) || []));
  }

  const maxSortIndex = Math.max(
    1,
    ...[...groups.values()].map((group) => Number.isFinite(group.sortIndex) ? group.sortIndex : 1),
  );

  const rows = [];
  for (const [key, group] of groups.entries()) {
    const checks = (streamMap.get(key) || []).slice(0, RECENT_LIMIT);
    const requestLogs = requestMap.get(key) || [];
    const successRate = checks.length
      ? Math.round((checks.filter((item) => item.success).length / checks.length) * 1000) / 10
      : (requestLogs.length
        ? Math.round((requestLogs.filter((item) => toNumber(item.status_code, 0) >= 200 && toNumber(item.status_code, 0) < 400).length / requestLogs.length) * 1000) / 10
        : null);
    const latencyMs = average(
      checks.length
        ? checks.filter((item) => item.success).map((item) => item.response_time_ms).concat(checks.map((item) => item.response_time_ms))
        : requestLogs.map((item) => item.latency_ms),
    );
    const latestCheck = checks[0] || null;
    const latestHealth = group.healthRows[0] || null;
    const lastTestedAt = toIsoTime(latestCheck ? latestCheck.tested_at : (latestHealth && latestHealth.updated_at));
    const failed = checks.find((item) => !item.success);
    const healthStatus = healthFrom(group, checks);
    const consecutiveFailures = group.healthRows.reduce(
      (max, item) => Math.max(max, toNumber(item.consecutive_failures, 0)),
      0,
    );
    const penalty = failurePenalty(checks);
    const models = uniqueSorted(
      checks.map((item) => item.model_used)
        .concat(requestLogs.map((item) => item.model))
        .slice(0, 20),
    ).slice(0, 6);
    const endpoint = uniqueSorted(group.endpoints)[0] || "";

    const details = {
      healthStatus,
      successRate,
      latencyMs,
      lastTestedAt,
      consecutiveFailures,
      penalty,
      maxSortIndex,
      now,
    };

    rows.push({
      name: group.name,
      format: group.format,
      formatLabel: normalizeFormatLabel(group.format),
      endpoint,
      websiteUrl: group.websiteUrl,
      models,
      healthStatus,
      lastTestedAt,
      successRate,
      latencyMs,
      failureSummary: summarizeFailure(failed),
      isCurrent: group.isCurrent,
      score: buildScore(group, details),
      tags: warningTags(group.name),
    });
  }

  return rows
    .filter((row) => row.endpoint)
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name), "zh-Hans-CN"));
}

export function buildRelayDataFromSql(sql, options = {}) {
  const tables = {};
  for (const table of TABLES) {
    tables[table] = parseTable(sql, table);
  }

  const providers = buildRelayRows(tables, options);
  return {
    meta: {
      schemaVersion: 2,
      generatedAt: (options.now instanceof Date ? options.now : new Date()).toISOString(),
      source: "cc-switch-export",
      sections: {
        linuxdo: {
          label: "LinuxDo 站",
          source: "cc-switch-export",
          generatedAt: (options.now instanceof Date ? options.now : new Date()).toISOString(),
          totalProviders: providers.length,
        },
        commercial: {
          label: "商业站",
          source: "external-actions",
          generatedAt: null,
          totalProviders: 0,
        },
      },
      totalProviders: providers.length,
      totalLinuxdoProviders: providers.length,
      totalCommercialProviders: 0,
    },
    providers,
    commercialProviders: [],
  };
}

async function main() {
  const { sqlPath, outPath } = parseArgs(process.argv);
  const sql = await readFile(sqlPath, "utf8");
  const output = buildRelayDataFromSql(sql);

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`✓ 已生成脱敏中转站 JSON: ${relative(ROOT, outPath)}`);
  console.log(`  中转站路由: ${output.meta.totalProviders}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
