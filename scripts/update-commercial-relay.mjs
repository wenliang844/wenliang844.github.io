#!/usr/bin/env node
// Fetch commercial relay data and merge sanitized rows into data/relay-providers.json.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_PATH = join(ROOT, "data", "relay-providers.json");

const HEALTH_STATUSES = new Set(["healthy", "degraded", "down", "unknown"]);

function cleanUrl(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  try {
    const url = new URL(text);
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return text.replace(/[?#].*$/, "").replace(/\/$/, "");
  }
}

function cleanNumber(value, fallback = null) {
  if (value == null || value === "") {
    return fallback;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanScore(value) {
  const number = cleanNumber(value, 0);
  return Math.max(0, Math.min(100, Math.round(number)));
}

function cleanText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function cleanFormat(value) {
  const text = cleanText(value).toLowerCase();
  if (text.includes("claude") || text.includes("anthropic")) {
    return "claude";
  }
  return "chatgpt";
}

function cleanFormatLabel(format) {
  return format === "claude" ? "Claude/Anthropic" : "ChatGPT/OpenAI";
}

function cleanHealth(value) {
  const text = cleanText(value, "unknown").toLowerCase();
  return HEALTH_STATUSES.has(text) ? text : "unknown";
}

function cleanArray(value, limit = 8) {
  const source = Array.isArray(value) ? value : (value ? [value] : []);
  return [...new Set(source.map((item) => cleanText(item)).filter(Boolean))].slice(0, limit);
}

function cleanTime(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function pickProviders(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.commercialProviders)) {
    return payload.commercialProviders;
  }
  if (payload && Array.isArray(payload.providers)) {
    return payload.providers;
  }
  return [];
}

function sanitizeProvider(input) {
  const format = cleanFormat(input.format || input.apiFormat || input.type);
  const endpoint = cleanUrl(input.endpoint || input.baseUrl || input.url);
  if (!endpoint) {
    return null;
  }

  return {
    name: cleanText(input.name || input.title || endpoint),
    format,
    formatLabel: cleanText(input.formatLabel) || cleanFormatLabel(format),
    endpoint,
    websiteUrl: cleanUrl(input.websiteUrl || input.website || input.consoleUrl),
    models: cleanArray(input.models || input.model),
    healthStatus: cleanHealth(input.healthStatus || input.status),
    lastTestedAt: cleanTime(input.lastTestedAt || input.updatedAt || input.checkedAt),
    successRate: cleanNumber(input.successRate),
    latencyMs: cleanNumber(input.latencyMs || input.responseTimeMs),
    failureSummary: cleanText(input.failureSummary || input.failure || input.error),
    isCurrent: Boolean(input.isCurrent),
    score: cleanScore(input.score),
    tags: cleanArray(input.tags, 6),
  };
}

function authHeaders() {
  const headers = { accept: "application/json" };
  if (process.env.RELAY_COMMERCIAL_TOKEN) {
    headers.authorization = `Bearer ${process.env.RELAY_COMMERCIAL_TOKEN}`;
  }
  if (process.env.RELAY_COMMERCIAL_HEADERS) {
    const custom = JSON.parse(process.env.RELAY_COMMERCIAL_HEADERS);
    for (const [key, value] of Object.entries(custom)) {
      headers[key] = String(value);
    }
  }
  return headers;
}

async function fetchCommercialProviders() {
  const sourceUrl = process.env.RELAY_COMMERCIAL_SOURCE_URL;
  if (!sourceUrl) {
    console.log("未配置 RELAY_COMMERCIAL_SOURCE_URL，跳过商业站同步。");
    return null;
  }

  const response = await fetch(sourceUrl, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(`商业站数据拉取失败: HTTP ${response.status}`);
  }
  const payload = await response.json();
  return pickProviders(payload).map(sanitizeProvider).filter(Boolean)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "zh-Hans-CN"));
}

async function main() {
  const providers = await fetchCommercialProviders();
  if (!providers) {
    return;
  }

  const now = new Date().toISOString();
  const data = JSON.parse(await readFile(DATA_PATH, "utf8"));
  const linuxdoProviders = Array.isArray(data.providers) ? data.providers : [];
  data.meta = data.meta || {};
  data.meta.schemaVersion = Math.max(2, cleanNumber(data.meta.schemaVersion, 2));
  data.meta.sections = data.meta.sections || {};
  data.meta.sections.linuxdo = {
    label: "LinuxDo 站",
    source: data.meta.sections.linuxdo && data.meta.sections.linuxdo.source || data.meta.source || "cc-switch-export",
    generatedAt: data.meta.sections.linuxdo && data.meta.sections.linuxdo.generatedAt || data.meta.generatedAt || null,
    totalProviders: linuxdoProviders.length,
  };
  data.meta.sections.commercial = {
    label: "商业站",
    source: process.env.RELAY_COMMERCIAL_SOURCE_NAME || "external-actions",
    generatedAt: now,
    totalProviders: providers.length,
  };
  data.meta.totalProviders = linuxdoProviders.length + providers.length;
  data.meta.totalLinuxdoProviders = linuxdoProviders.length;
  data.meta.totalCommercialProviders = providers.length;
  data.commercialMeta = {
    generatedAt: now,
    source: data.meta.sections.commercial.source,
    totalProviders: providers.length,
  };
  data.commercialProviders = providers;

  await writeFile(DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`已同步商业站中转数据: ${providers.length} 条。`);
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
