import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { buildRelayDataFromSql } from "../scripts/parse-relay.mjs";

const ROOT = join(import.meta.dirname, "..");

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
  assert.doesNotMatch(raw, /sk-[A-Za-z0-9]|tp-[A-Za-z0-9]|fe_oa_|rt\./);

  const data = JSON.parse(raw);
  assert.ok(Array.isArray(data.providers));
  assert.ok(Array.isArray(data.commercialProviders));
  assert.equal(data.meta.sections.linuxdo.label, "LinuxDo 站");
  assert.equal(data.meta.sections.commercial.label, "商业站");
  assert.ok(data.providers.length > 0);
  assert.ok(data.providers.every((provider) => provider.name && provider.format && provider.endpoint));
});
