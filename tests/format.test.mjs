// Phase 4: format.mjs 格式化函数完整测试
import test from "node:test";
import assert from "node:assert/strict";
import { isoDate, longDate, rfc822, sitemapDate, escapeAttr, escapeHtml, escapeXml } from "../src/lib/format.mjs";

// ─── isoDate ───────────────────────────────────────────────────────────────────

test("isoDate returns the input string unchanged", () => {
  assert.equal(isoDate("2024-06-16"), "2024-06-16");
  assert.equal(isoDate("2000-01-01"), "2000-01-01");
});

// ─── longDate ──────────────────────────────────────────────────────────────────

test("longDate formats dates correctly", () => {
  assert.equal(longDate("2024-01-15"), "January 15, 2024");
  assert.equal(longDate("2024-06-01"), "June 1, 2024");
  assert.equal(longDate("2024-12-31"), "December 31, 2024");
  assert.equal(longDate("2000-02-29"), "February 29, 2000");
});

test("longDate handles all 12 months", () => {
  const expected = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  for (let i = 0; i < 12; i++) {
    const month = String(i + 1).padStart(2, "0");
    const result = longDate(`2024-${month}-01`);
    assert.ok(result.startsWith(expected[i]), `Month ${i + 1} should start with ${expected[i]}, got: ${result}`);
  }
});

// ─── rfc822 ────────────────────────────────────────────────────────────────────

test("rfc822 produces correct RSS date format", () => {
  const result = rfc822("2024-06-16");
  assert.match(result, /^\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} \+0800$/);
  assert.equal(result, "Sun, 16 Jun 2024 09:30:00 +0800");
});

test("rfc822 handles first day of month", () => {
  assert.equal(rfc822("2024-01-01"), "Mon, 01 Jan 2024 09:30:00 +0800");
});

test("rfc822 handles last day of year", () => {
  assert.equal(rfc822("2024-12-31"), "Tue, 31 Dec 2024 09:30:00 +0800");
});

test("rfc822 pads single-digit days with zero", () => {
  const result = rfc822("2024-03-05");
  assert.match(result, /05 Mar 2024/);
});

// ─── sitemapDate ───────────────────────────────────────────────────────────────

test("sitemapDate produces ISO 8601 format with timezone", () => {
  assert.equal(sitemapDate("2024-06-16"), "2024-06-16T09:30:00+08:00");
  assert.equal(sitemapDate("2000-01-01"), "2000-01-01T09:30:00+08:00");
});

// ─── escapeAttr ────────────────────────────────────────────────────────────────

test("escapeAttr escapes ampersands, angle brackets, and quotes", () => {
  assert.equal(escapeAttr('a&b<c>"e'), "a&amp;b&lt;c&gt;&quot;e");
});

test("escapeAttr handles null and undefined", () => {
  assert.equal(escapeAttr(null), "");
  assert.equal(escapeAttr(undefined), "");
});

test("escapeAttr handles empty string", () => {
  assert.equal(escapeAttr(""), "");
});

test("escapeAttr handles numbers", () => {
  assert.equal(escapeAttr(42), "42");
});

test("escapeAttr does not escape single quotes", () => {
  assert.equal(escapeAttr("it's"), "it's");
});

// ─── escapeHtml ────────────────────────────────────────────────────────────────

test("escapeHtml escapes all HTML special characters including single quotes", () => {
  assert.equal(escapeHtml(`<script>alert("XSS&'")</script>`), "&lt;script&gt;alert(&quot;XSS&amp;&#39;&quot;)&lt;/script&gt;");
});

test("escapeHtml handles null and undefined", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("escapeHtml handles numeric values", () => {
  assert.equal(escapeHtml(0), "0");
  assert.equal(escapeHtml(123), "123");
});

test("escapeHtml handles nested tags", () => {
  assert.equal(escapeHtml("<div><span>text</span></div>"), "&lt;div&gt;&lt;span&gt;text&lt;/span&gt;&lt;/div&gt;");
});

// ─── escapeXml ─────────────────────────────────────────────────────────────────

test("escapeXml escapes all 5 XML special characters", () => {
  assert.equal(escapeXml(`&<>"'`), "&amp;&lt;&gt;&quot;&apos;");
});

test("escapeXml handles null and undefined", () => {
  assert.equal(escapeXml(null), "");
  assert.equal(escapeXml(undefined), "");
});

test("escapeXml handles empty string", () => {
  assert.equal(escapeXml(""), "");
});

test("escapeXml handles complex XML content", () => {
  const input = '<title attr="val">A & B\'s "Blog"</title>';
  const expected = "&lt;title attr=&quot;val&quot;&gt;A &amp; B&apos;s &quot;Blog&quot;&lt;/title&gt;";
  assert.equal(escapeXml(input), expected);
});

// ─── 交叉验证：escapeHtml 是 escapeAttr 的超集（多了单引号） ────────────────────

test("escapeHtml always escapes single quotes while escapeAttr does not", () => {
  const input = "it's";
  assert.equal(escapeAttr(input), "it's");
  assert.equal(escapeHtml(input), "it&#39;s");
});

// ─── 一致性验证：所有 escape 函数都不修改无特殊字符的文本 ────────────────────────

test("escape functions preserve plain text", () => {
  const plain = "Hello World 123";
  assert.equal(escapeAttr(plain), plain);
  assert.equal(escapeHtml(plain), plain);
  assert.equal(escapeXml(plain), plain);
});

test("escape functions handle Chinese text without modification", () => {
  const chinese = "你好世界";
  assert.equal(escapeAttr(chinese), chinese);
  assert.equal(escapeHtml(chinese), chinese);
  assert.equal(escapeXml(chinese), chinese);
});

test("escape functions handle emoji without modification", () => {
  const emoji = "🎉🚀";
  assert.equal(escapeAttr(emoji), emoji);
  assert.equal(escapeHtml(emoji), emoji);
  assert.equal(escapeXml(emoji), emoji);
});
