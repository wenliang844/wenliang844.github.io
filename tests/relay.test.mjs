import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { buildRelayDataFromSql } from "../scripts/parse-relay.mjs";
import { fetchCommercialProviders } from "../scripts/update-commercial-relay.mjs";

const ROOT = join(import.meta.dirname, "..");
const execFileAsync = promisify(execFile);
const COMMERCIAL_ENV_KEYS = [
  "RELAY_COMMERCIAL_SOURCE_URL",
  "RELAY_COMMERCIAL_REQUIRED",
  "RELAY_COMMERCIAL_TOKEN",
  "RELAY_COMMERCIAL_HEADERS",
];

async function withCommercialEnv(values, fn) {
  const original = new Map(COMMERCIAL_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of COMMERCIAL_ENV_KEYS) {
    if (Object.hasOwn(values, key)) {
      process.env[key] = values[key];
    } else {
      delete process.env[key];
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("relay SQL import emits sanitized ranking fields only", () => {
  const sql = `
INSERT INTO "providers" ("id", "app_type", "name", "settings_config", "website_url", "category", "created_at", "sort_index", "notes", "icon", "icon_color", "meta", "is_current", "in_failover_queue", "cost_multiplier", "limit_daily_usd", "limit_monthly_usd", "provider_type") VALUES ('p1', 'codex', 'anyRouter-需要签到', '{"auth":{"OPENAI_API_KEY":"sk-sensitive","tokens":{"access_token":"secret-token","refresh_token":"rt.secret"},"account_id":"acct-secret"},"email":"person@example.com"}', 'https://relay.example/console?userId=acct-secret#profile', NULL, 1780000000000, 1, NULL, NULL, NULL, '{"apiFormat":"openai_responses"}', 1, 0, '1.0', NULL, NULL, NULL);
INSERT INTO "provider_endpoints" ("id", "provider_id", "app_type", "url", "added_at") VALUES (1, 'p1', 'codex', 'https://relay.example/v1?token=secret#frag', 1780000000000);
INSERT INTO "provider_health" ("provider_id", "app_type", "is_healthy", "consecutive_failures", "last_success_at", "last_failure_at", "last_error", "updated_at") VALUES ('p1', 'codex', 1, 0, '2026-06-17T01:00:00.000Z', NULL, NULL, '2026-06-17T01:00:00.000Z');
INSERT INTO "stream_check_logs" ("id", "provider_id", "provider_name", "app_type", "status", "success", "message", "response_time_ms", "http_status", "model_used", "retry_count", "tested_at") VALUES (1, 'p1', 'anyRouter-需要签到', 'codex', 'operational', 1, 'Check succeeded with sk-sensitive', 420, 200, 'gpt-test', 0, 1781660848);
`;

  const data = buildRelayDataFromSql(sql, { now: new Date("2026-06-18T00:00:00.000Z") });
  assert.equal(data.meta.schemaVersion, 2);
  assert.equal(data.meta.sections.linuxdo.label, "LinuxDo 站");
  assert.equal(data.meta.sections.commercial.label, "商业站");
  assert.deepEqual(data.commercialProviders, []);
  assert.equal(data.providers.length, 1);
  assert.deepEqual(Object.keys(data.providers[0]).sort(), [
    "endpoint",
    "failureSummary",
    "format",
    "formatLabel",
    "healthStatus",
    "isCurrent",
    "lastTestedAt",
    "latencyMs",
    "models",
    "name",
    "score",
    "successRate",
    "tags",
    "websiteUrl",
  ].sort());
  assert.equal(data.providers[0].format, "chatgpt");
  assert.equal(data.providers[0].endpoint, "https://relay.example/v1");
  assert.equal(data.providers[0].websiteUrl, "https://relay.example/console");
  assert.equal(data.providers[0].isCurrent, true);
  assert.deepEqual(data.providers[0].models, ["gpt-test"]);
  assert.deepEqual(data.providers[0].tags, ["需要签到"]);

  const serialized = JSON.stringify(data);
  assert.doesNotMatch(serialized, /settings_config|OPENAI_API_KEY|access_token|refresh_token|account_id|userId/i);
  assert.doesNotMatch(serialized, /sk-sensitive|rt\.secret|person@example\.com|acct-secret/);
});

test("generated relay data does not contain known secret markers", async () => {
  const raw = await readFile(join(ROOT, "data", "relay-providers.json"), "utf8");
  assert.doesNotMatch(raw, /settings_config|OPENAI_API_KEY|ANTHROPIC_AUTH_TOKEN|access_token|refresh_token|id_token|account_id|userId/i);
  assert.doesNotMatch(raw, /sk-[A-Za-z0-9_-]{8,}|tp-[A-Za-z0-9_-]{8,}|fe_oa_|rt\.[A-Za-z0-9_-]{8,}/);

  const data = JSON.parse(raw);
  assert.ok(Array.isArray(data.providers));
  assert.ok(Array.isArray(data.commercialProviders));
  assert.equal(data.meta.sections.linuxdo.label, "LinuxDo 站");
  assert.equal(data.meta.sections.commercial.label, "商业站");
  assert.ok(data.providers.length > 0);
  assert.ok(data.providers.every((provider) => provider.name && provider.format && provider.endpoint));
});

test("relay SQL import skips official providers and summarizes failures", () => {
  const sql = `
INSERT INTO "providers" ("id", "app_type", "name", "category", "meta", "website_url", "is_current", "sort_index", "created_at") VALUES ('official', 'codex', 'Official Provider', 'official', '{}', 'https://official.example', 1, 1, 1780000000000);
INSERT INTO "providers" ("id", "app_type", "name", "category", "meta", "website_url", "is_current", "sort_index", "created_at") VALUES ('p-fail', 'claude', 'Claude 慢', NULL, '{"apiFormat":"anthropic"}', 'https://claude.example/console?secret=1#frag', 0, 5, 1780000000000);
INSERT INTO "providers" ("id", "app_type", "name", "category", "meta", "website_url", "is_current", "sort_index", "created_at") VALUES ('p-logs', 'codex', 'Logs Relay', NULL, '{bad-json', '', 0, 2, 1780000000000);
INSERT INTO "provider_endpoints" ("provider_id", "app_type", "url") VALUES ('official', 'codex', 'https://official.example/v1');
INSERT INTO "provider_endpoints" ("provider_id", "app_type", "url") VALUES ('p-fail', 'claude', 'https://claude.example/v1/messages?token=secret#frag');
INSERT INTO "provider_endpoints" ("provider_id", "app_type", "url") VALUES ('p-logs', 'codex', 'https://logs.example/v1/responses?token=secret');
INSERT INTO "provider_health" ("provider_id", "app_type", "is_healthy", "consecutive_failures", "updated_at") VALUES ('p-fail', 'claude', 0, 3, '2026-06-17T01:00:00.000Z');
INSERT INTO "stream_check_logs" ("provider_id", "app_type", "status", "success", "message", "response_time_ms", "http_status", "model_used", "tested_at") VALUES ('p-fail', 'claude', 'failed', 0, 'rate limited by upstream', 9000, 429, 'claude-test', 1781660848);
INSERT INTO "proxy_request_logs" ("provider_id", "app_type", "status_code", "latency_ms", "model") VALUES ('p-logs', 'codex', 200, 500, 'gpt-4o');
INSERT INTO "proxy_request_logs" ("provider_id", "app_type", "status_code", "latency_ms", "model") VALUES ('p-logs', 'codex', 500, 1500, 'gpt-4o');
`;

  const data = buildRelayDataFromSql(sql, { now: new Date("2026-06-18T00:00:00.000Z") });
  assert.equal(data.providers.length, 2);
  assert.equal(data.providers.some((provider) => provider.name === "Official Provider"), false);

  const failed = data.providers.find((provider) => provider.name === "Claude 慢");
  assert.equal(failed.format, "claude");
  assert.equal(failed.endpoint, "https://claude.example/v1/messages");
  assert.equal(failed.websiteUrl, "https://claude.example/console");
  assert.equal(failed.healthStatus, "down");
  assert.equal(failed.failureSummary, "频率限制");
  assert.deepEqual(failed.models, ["claude-test"]);
  assert.deepEqual(failed.tags, ["慢"]);

  const requestBacked = data.providers.find((provider) => provider.name === "Logs Relay");
  assert.equal(requestBacked.format, "chatgpt");
  assert.equal(requestBacked.endpoint, "https://logs.example/v1");
  assert.equal(requestBacked.successRate, 50);
  assert.equal(requestBacked.latencyMs, 1000);
  assert.deepEqual(requestBacked.models, ["gpt-4o"]);
});

test("parse relay CLI rejects missing arguments and unsafe output paths", async () => {
  await assert.rejects(
    execFileAsync("node", ["scripts/parse-relay.mjs"], { cwd: ROOT, windowsHide: true }),
    /用法:/,
  );

  await assert.rejects(
    execFileAsync("node", ["scripts/parse-relay.mjs", "data/relay-providers.json", "--out", "../outside.json"], {
      cwd: ROOT,
      windowsHide: true,
    }),
    /--out 只能写入项目内路径/,
  );
});

test("commercial relay sync reports optional and required missing sources", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const optional = await withCommercialEnv({}, () => fetchCommercialProviders());
    assert.equal(optional, null);

    await assert.rejects(
      withCommercialEnv({ RELAY_COMMERCIAL_REQUIRED: "1" }, () => fetchCommercialProviders()),
      /未配置 RELAY_COMMERCIAL_SOURCE_URL/,
    );
  } finally {
    console.log = originalLog;
  }
});

test("commercial relay sync sends auth headers and sanitizes provider fields", async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const calls = [];

  console.log = () => {};
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), headers: options.headers });
    return {
      ok: true,
      json: async () => [
        {
          title: "Header Relay",
          baseUrl: "https://relay.example/v1?token=secret#frag",
          website: "https://relay.example/console?user=secret",
          model: ["gpt-4o", "gpt-4o", ""],
          status: "mystery",
          updatedAt: "not-a-date",
          successRate: "not-a-number",
          latencyMs: "250",
          score: 125,
          tags: ["fast", "fast", ""],
          isCurrent: "false",
        },
      ],
    };
  };

  try {
    const providers = await withCommercialEnv(
      {
        RELAY_COMMERCIAL_SOURCE_URL: "https://source.example/data",
        RELAY_COMMERCIAL_TOKEN: "token-123",
        RELAY_COMMERCIAL_HEADERS: '{"x-api-key":"custom-secret","x-number":123}',
      },
      () => fetchCommercialProviders(),
    );

    assert.equal(calls[0].url, "https://source.example/data");
    assert.equal(calls[0].headers.accept, "application/json");
    assert.equal(calls[0].headers.authorization, "Bearer token-123");
    assert.equal(calls[0].headers["x-api-key"], "custom-secret");
    assert.equal(calls[0].headers["x-number"], "123");

    assert.equal(providers.length, 1);
    assert.equal(providers[0].name, "Header Relay");
    assert.equal(providers[0].endpoint, "https://relay.example/v1");
    assert.equal(providers[0].websiteUrl, "https://relay.example/console");
    assert.deepEqual(providers[0].models, ["gpt-4o"]);
    assert.equal(providers[0].healthStatus, "unknown");
    assert.equal(providers[0].lastTestedAt, null);
    assert.equal(providers[0].successRate, null);
    assert.equal(providers[0].latencyMs, 250);
    assert.equal(providers[0].score, 100);
    assert.deepEqual(providers[0].tags, ["fast"]);
    assert.equal(providers[0].isCurrent, false);
  } finally {
    console.log = originalLog;
    globalThis.fetch = originalFetch;
  }
});

test("commercial relay sync rejects malformed custom headers before fetching", async () => {
  const originalFetch = globalThis.fetch;
  let fetched = false;
  globalThis.fetch = async () => {
    fetched = true;
    return { ok: true, json: async () => [] };
  };

  try {
    await assert.rejects(
      withCommercialEnv(
        {
          RELAY_COMMERCIAL_SOURCE_URL: "https://source.example/data",
          RELAY_COMMERCIAL_HEADERS: "{not-json",
        },
        () => fetchCommercialProviders(),
      ),
      /JSON|Expected/,
    );
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("commercial relay sync merges multiple sources and skips failed sources", async () => {
  const originalFetch = globalThis.fetch;
  const originalSource = process.env.RELAY_COMMERCIAL_SOURCE_URL;
  const originalRequired = process.env.RELAY_COMMERCIAL_REQUIRED;
  const originalLog = console.log;
  const originalWarn = console.warn;
  const calls = [];

  process.env.RELAY_COMMERCIAL_SOURCE_URL = "https://one.example/data, https://two.example/data, https://down.example/data";
  delete process.env.RELAY_COMMERCIAL_REQUIRED;
  console.log = () => {};
  console.warn = () => {};
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("down.example")) {
      return { ok: false, status: 503, json: async () => ({}) };
    }
    if (String(url).includes("one.example")) {
      return {
        ok: true,
        json: async () => ({
          commercialProviders: [
            { name: "Fast Relay", endpoint: "https://relay.example/v1?token=secret", score: 95, format: "openai" },
            { name: "Duplicate Relay", endpoint: "https://dupe.example/v1", score: 50 },
          ],
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        providers: [
          { name: "Claude Relay", endpoint: "https://claude.example/v1", score: 90, apiFormat: "anthropic" },
          { name: "Duplicate Relay Newer", endpoint: "https://dupe.example/v1", score: 99 },
        ],
      }),
    };
  };

  try {
    const providers = await fetchCommercialProviders();

    assert.deepEqual(calls, [
      "https://one.example/data",
      "https://two.example/data",
      "https://down.example/data",
    ]);
    assert.deepEqual(providers.map((provider) => provider.endpoint), [
      "https://relay.example/v1",
      "https://claude.example/v1",
      "https://dupe.example/v1",
    ]);
    assert.equal(providers[0].name, "Fast Relay");
    assert.equal(providers[1].format, "claude");
    assert.equal(providers[2].name, "Duplicate Relay");
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    globalThis.fetch = originalFetch;
    if (originalSource === undefined) {
      delete process.env.RELAY_COMMERCIAL_SOURCE_URL;
    } else {
      process.env.RELAY_COMMERCIAL_SOURCE_URL = originalSource;
    }
    if (originalRequired === undefined) {
      delete process.env.RELAY_COMMERCIAL_REQUIRED;
    } else {
      process.env.RELAY_COMMERCIAL_REQUIRED = originalRequired;
    }
  }
});
