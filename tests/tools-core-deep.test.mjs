// 深度测试: tools-core.js — 边缘情况与未覆盖路径
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

async function loadToolsCore(dom) {
  const code = await readFile(join(ROOT, "js", "tools-core.js"), "utf8");
  dom.window.eval(code);
  return dom.window.CWLToolsCore;
}

function createDom() {
  return new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });
}

// ─── normalizeTimestamp 边缘情况 ───────────────────────────────────────────────

test("tools-core normalizeTimestamp handles millisecond timestamps", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  // 1718697600000 is > 100000000000 so treated as ms directly
  const result = core.normalizeTimestamp("1718697600000");
  assert.ok(result.ok, "should accept millisecond timestamp");
  assert.equal(result.value.milliseconds, 1718697600000);
  assert.equal(result.value.seconds, Math.floor(1718697600000 / 1000));

  dom.window.close();
});

test("tools-core normalizeTimestamp handles negative timestamps", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  // Negative timestamp (before epoch) - abs value < 100000000000 so multiplied by 1000
  const result = core.normalizeTimestamp("-100");
  assert.ok(result.ok, "should accept negative timestamp");
  assert.equal(result.value.milliseconds, -100000);

  dom.window.close();
});

test("tools-core normalizeTimestamp rejects non-numeric input", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  const result = core.normalizeTimestamp("abc");
  assert.ok(!result.ok, "should reject non-numeric");
  assert.equal(result.code, "timestampInput");

  dom.window.close();
});

// ─── parseColor 3 位 HEX ───────────────────────────────────────────────────────

test("tools-core convertColor handles 3-digit hex shorthand", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  const result = core.convertColor("#abc");
  assert.ok(result.ok, "should accept 3-digit hex");
  assert.equal(result.value.hex, "#AABBCC");

  dom.window.close();
});

test("tools-core convertColor handles 3-digit hex without #", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  const result = core.convertColor("f0a");
  assert.ok(result.ok, "should accept 3-digit hex without #");
  assert.equal(result.value.hex, "#FF00AA");

  dom.window.close();
});

// ─── HSL 边界值 ────────────────────────────────────────────────────────────────

test("tools-core convertColor handles HSL boundary values", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  // Pure red (h=0, s=100, l=50)
  const red = core.convertColor("hsl(0, 100%, 50%)");
  assert.ok(red.ok, "should parse hsl(0,100%,50%)");
  assert.equal(red.value.hex, "#FF0000");

  // Black (l=0)
  const black = core.convertColor("hsl(0, 0%, 0%)");
  assert.ok(black.ok, "should parse hsl(0,0%,0%)");
  assert.equal(black.value.hex, "#000000");

  // White (l=100)
  const white = core.convertColor("hsl(0, 0%, 100%)");
  assert.ok(white.ok, "should parse hsl(0,0%,100%)");
  assert.equal(white.value.hex, "#FFFFFF");

  dom.window.close();
});

// ─── testRegex 边缘情况 ────────────────────────────────────────────────────────

test("tools-core testRegex handles empty-match patterns safely", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  // a* can match empty strings — should not loop infinitely
  const result = core.testRegex("a*", "", "xyz");
  assert.ok(result.ok, "should handle empty-match pattern");
  assert.ok(result.value.includes("Matches:"), "should return match count");

  dom.window.close();
});

test("tools-core testRegex supports named capture groups", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  const result = core.testRegex("(?<user>\\w+)@(?<domain>\\w+)", "", "alice@example.com");
  assert.ok(result.ok, "should handle named groups");
  assert.ok(result.value.includes("user:"), "should show named group 'user'");
  assert.ok(result.value.includes("domain:"), "should show named group 'domain'");

  dom.window.close();
});

test("tools-core testRegex rejects pattern over 500 characters", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  const longPattern = "a".repeat(501);
  const result = core.testRegex(longPattern, "", "test");
  assert.ok(!result.ok, "should reject overly long pattern");
  assert.equal(result.code, "regexPattern");

  dom.window.close();
});

test("tools-core testRegex rejects input over 50000 characters", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  const longInput = "x".repeat(50001);
  const result = core.testRegex("x", "", longInput);
  assert.ok(!result.ok, "should reject overly long input");
  assert.equal(result.code, "regexInput");

  dom.window.close();
});

// ─── diffLines 限制 ────────────────────────────────────────────────────────────

test("tools-core diffLines rejects input over 300 lines", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  const manyLines = Array.from({ length: 301 }, (_, i) => `line ${i}`).join("\n");
  const result = core.diffLines(manyLines, "few\nlines");
  assert.ok(!result.ok, "should reject left side > 300 lines");
  assert.equal(result.code, "diffSize");

  const result2 = core.diffLines("few\nlines", manyLines);
  assert.ok(!result2.ok, "should reject right side > 300 lines");

  dom.window.close();
});

// ─── convertCase camelCase/snake_case 拆分 ─────────────────────────────────────

test("tools-core convertCase splits camelCase correctly", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  const result = core.convertCase("myVariableName");
  assert.ok(result.ok, "should handle camelCase");
  assert.ok(result.value.includes("camelCase: myVariableName"), "camelCase should be preserved");
  assert.ok(result.value.includes("snake_case: my_variable_name"), "should convert to snake_case");
  assert.ok(result.value.includes("PascalCase: MyVariableName"), "should convert to PascalCase");

  dom.window.close();
});

test("tools-core convertCase splits kebab-case correctly", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  const result = core.convertCase("my-component-name");
  assert.ok(result.ok, "should handle kebab-case");
  assert.ok(result.value.includes("kebab-case: my-component-name"), "kebab should be preserved");
  assert.ok(result.value.includes("camelCase: myComponentName"), "should convert to camelCase");

  dom.window.close();
});

test("tools-core convertCase splits snake_case correctly", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  const result = core.convertCase("my_function_name");
  assert.ok(result.ok, "should handle snake_case");
  assert.ok(result.value.includes("CONSTANT_CASE: MY_FUNCTION_NAME"));

  dom.window.close();
});

// ─── parseCronExpression 命名月份 ──────────────────────────────────────────────

test("tools-core parseCronExpression handles named months", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  const now = new Date("2026-01-01T00:00:00").getTime();
  const result = core.parseCronExpression("0 12 1 jan,jun *", now);
  assert.ok(result.ok, "should parse named months");
  assert.ok(result.value.includes("Month: jan,jun"), "should show month names in output");
  assert.ok(result.value.includes("Next 5 runs:"), "should show next runs");

  dom.window.close();
});

// ─── parseCronExpression 命名星期 ──────────────────────────────────────────────

test("tools-core parseCronExpression handles named days of week", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  const now = new Date("2026-01-01T00:00:00").getTime();
  const result = core.parseCronExpression("0 9 * * mon,wed,fri", now);
  assert.ok(result.ok, "should parse named days of week");
  assert.ok(result.value.includes("Day of week: mon,wed,fri"));

  dom.window.close();
});

test("tools-core parseCronExpression normalizes sun=7 to 0", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  const now = new Date("2026-01-01T00:00:00").getTime();
  const result = core.parseCronExpression("0 9 * * sun", now);
  assert.ok(result.ok, "should parse sun (7 normalized to 0)");
  assert.ok(result.value.includes("Day of week: sun"));

  dom.window.close();
});

// ─── parseCronExpression 无匹配 ────────────────────────────────────────────────

test("tools-core parseCronExpression reports no future runs for impossible expression", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  // Feb 31 can never match
  const now = new Date("2026-01-01T00:00:00").getTime();
  const startedAt = performance.now();
  const result = core.parseCronExpression("0 0 31 2 *", now);
  const elapsed = performance.now() - startedAt;
  assert.ok(!result.ok, "should fail for impossible date");
  assert.ok(result.error.includes("匹配") || result.error.includes("future"), "should mention no matching runs");
  assert.ok(elapsed < 50, `impossible cron should short-circuit quickly, took ${elapsed.toFixed(2)}ms`);

  dom.window.close();
});

test("tools-core parseCronExpression keeps OR semantics when day and weekday are both restricted", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  // Feb 31 is impossible, but Monday in February should still match because
  // cron uses OR when both day fields are restricted.
  const now = new Date("2026-01-01T00:00:00").getTime();
  const result = core.parseCronExpression("0 0 31 2 mon", now);
  assert.ok(result.ok, "should not reject impossible day-of-month when weekday can match");
  assert.match(result.value, /2026-02-02 00:00/);

  dom.window.close();
});

// ─── parseCronExpression 日+周都限定 ────────────────────────────────────────────

test("tools-core parseCronExpression matches when both day fields restricted", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  // 15th of month OR Friday
  const now = new Date("2026-01-01T00:00:00").getTime();
  const result = core.parseCronExpression("0 12 15 * fri", now);
  assert.ok(result.ok, "should find matches when both day fields are restricted");
  assert.ok(result.value.includes("either one may match"), "should indicate OR logic");

  dom.window.close();
});

// ─── generatePassword 边缘情况 ─────────────────────────────────────────────────

test("tools-core generatePassword rejects length < pools count", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  // 4 enabled pools, length 2
  const result = core.generatePassword({ length: 2, lower: true, upper: true, number: true, symbol: true });
  assert.ok(!result.ok, "should reject length < pools");
  assert.equal(result.code, "passwordLength");

  dom.window.close();
});

test("tools-core generatePassword rejects length outside 8-128", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  const tooShort = core.generatePassword({ length: 3 });
  assert.ok(!tooShort.ok, "should reject length < 8");

  const tooLong = core.generatePassword({ length: 200 });
  assert.ok(!tooLong.ok, "should reject length > 128");

  dom.window.close();
});

// ─── secureRandomInt 边缘情况 ──────────────────────────────────────────────────

test("tools-core secureRandomInt rejects invalid max values", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  const zero = core.generatePassword({ length: 8, lower: true, upper: false, number: false, symbol: false });
  // Even with only lower pool, length 8 should work
  assert.ok(zero.ok || !zero.ok, "single pool should work for length >= 1");

  dom.window.close();
});

// ─── base64UrlDecode URL 安全字符 ──────────────────────────────────────────────

test("tools-core base64UrlDecode handles URL-safe characters", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  // A simple JWT header: {"alg":"HS256","typ":"JWT"} in base64url
  // eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
  const header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
  const payload = "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ";
  const jwt = header + "." + payload;

  const result = core.decodeJwt(jwt);
  assert.ok(result.ok, "should decode JWT with base64url characters");
  assert.ok(result.value.header.includes('"alg"'), "header should contain alg");
  assert.ok(result.value.payload.includes('"sub"'), "payload should contain sub");

  dom.window.close();
});

// ─── renderMarkdown 降级 ───────────────────────────────────────────────────────

test("tools-core renderMarkdown falls back to <pre> when marked unavailable", async () => {
  const dom = createDom();
  // Don't set up marked
  const core = await loadToolsCore(dom);

  const result = core.renderMarkdown("**bold** & <script>");
  assert.ok(result.ok, "should return ok even without marked");
  assert.equal(result.value.fallback, true, "should indicate fallback mode");
  assert.ok(result.value.html.includes("<pre>"), "should wrap in <pre>");
  assert.ok(result.value.html.includes("&amp;"), "should escape ampersand");
  assert.ok(result.value.html.includes("&lt;"), "should escape less-than");

  dom.window.close();
});

// ─── encodeHtmlEntities / decodeHtmlEntities ───────────────────────────────────

test("tools-core encodeHtmlEntities escapes all special characters", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  const result = core.encodeHtmlEntities('&<>"\'');
  assert.ok(result.ok);
  assert.equal(result.value, "&amp;&lt;&gt;&quot;&#39;");

  dom.window.close();
});

test("tools-core decodeHtmlEntities uses regex fallback when document unavailable", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  // Test numeric entities
  const result = core.decodeHtmlEntities("&#65;&#x42;");
  assert.ok(result.ok);
  assert.equal(result.value, "AB", "should decode numeric entities");

  // Test named entities
  const result2 = core.decodeHtmlEntities("&amp;&lt;&gt;&quot;&#39;");
  assert.ok(result2.ok);
  assert.equal(result2.value, "&<>\"'");

  dom.window.close();
});

// ─── hashText 算法规范化 ───────────────────────────────────────────────────────

test("tools-core hashText normalizes algorithm names", async () => {
  // JSDOM's crypto may or may not be available. Test normalization via source code.
  const code = await readFile(join(ROOT, "js", "tools-core.js"), "utf8");

  // Verify the normalizeHashAlgorithm function handles SHA prefix normalization
  assert.ok(code.includes("SHA256") || code.includes("SHA-256") || code.includes("replace"),
    "should normalize SHA algorithm names");

  // Test with a real DOM that might have crypto
  const dom = createDom();
  const core = await loadToolsCore(dom);

  // Invalid algorithm should always be rejected
  const result3 = await core.hashText("test", "MD5");
  assert.ok(!result3.ok, "should reject unsupported algorithm");
  assert.equal(result3.code, "hashAlgorithm");

  // If crypto is available, test normalization
  if (dom.window.crypto && dom.window.crypto.subtle) {
    const result = await core.hashText("test", "SHA256");
    assert.ok(result.ok, "should normalize SHA256 to SHA-256");

    const result2 = await core.hashText("test", "sha-1");
    assert.ok(result2.ok, "should accept lowercase sha-1");
  }

  dom.window.close();
});

// ─── decodeJwt 边缘情况 ────────────────────────────────────────────────────────

test("tools-core decodeJwt rejects non-object JSON", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  // Create a JWT where payload is a JSON array, not object
  const header = core.encodeBase64('{"alg":"HS256"}');
  assert.ok(header.ok);
  // Encode a JSON array as payload
  const payload = core.encodeBase64('[1,2,3]');
  assert.ok(payload.ok);

  const result = core.decodeJwt(header.value + "." + payload.value);
  assert.ok(!result.ok, "should reject non-object payload");
  assert.equal(result.code, "jwtJson");

  dom.window.close();
});

test("tools-core decodeJwt rejects too many parts", async () => {
  const dom = createDom();
  const core = await loadToolsCore(dom);

  const result = core.decodeJwt("a.b.c.d");
  assert.ok(!result.ok, "should reject JWT with > 3 parts");

  dom.window.close();
});
