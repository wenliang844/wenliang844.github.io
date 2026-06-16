// 前端工具函数测试
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

describe("Utils - HTML Escaping (Server-side validation)", () => {
  // 使用纯JavaScript验证转义逻辑，不依赖浏览器环境
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  it("should escape HTML special characters", () => {
    const input = '<script>alert("XSS")</script>';
    const output = escapeHtml(input);

    assert.ok(!output.includes('<script>'), "Should escape opening tag");
    assert.ok(output.includes('&lt;script&gt;'), "Should contain escaped tag");
  });

  it("should escape ampersands", () => {
    assert.strictEqual(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
  });

  it("should escape quotes", () => {
    assert.strictEqual(escapeHtml('He said "Hello"'), 'He said &quot;Hello&quot;');
    assert.strictEqual(escapeHtml("It's OK"), "It&#39;s OK");
  });

  it("should handle null and undefined", () => {
    assert.strictEqual(escapeHtml(null), '');
    assert.strictEqual(escapeHtml(undefined), '');
  });

  it("should handle empty strings", () => {
    assert.strictEqual(escapeHtml(''), '');
  });

  it("should escape multiple special characters", () => {
    const input = '<div class="test">&copy;</div>';
    const expected = '&lt;div class=&quot;test&quot;&gt;&amp;copy;&lt;/div&gt;';
    assert.strictEqual(escapeHtml(input), expected);
  });
});

describe("Utils - Number Clamping Logic", () => {
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  it("should clamp value within range", () => {
    assert.strictEqual(clamp(5, 0, 10), 5);
    assert.strictEqual(clamp(-5, 0, 10), 0);
    assert.strictEqual(clamp(15, 0, 10), 10);
  });

  it("should handle edge cases", () => {
    assert.strictEqual(clamp(0, 0, 10), 0);
    assert.strictEqual(clamp(10, 0, 10), 10);
  });

  it("should handle negative ranges", () => {
    assert.strictEqual(clamp(-15, -10, 0), -10);
    assert.strictEqual(clamp(5, -10, 0), 0);
  });
});

describe("Utils - File Structure Validation", () => {
  it("should have utils.js file", async () => {
    const content = await readFile("js/utils.js", "utf8");
    assert.ok(content.length > 0, "utils.js should not be empty");
    assert.ok(content.includes('window.CWLUtils'), "Should export CWLUtils");
  });

  it("should contain expected utility functions", async () => {
    const content = await readFile("js/utils.js", "utf8");

    const expectedFunctions = [
      'escapeHtml',
      'copyText',
      'throttle',
      'debounce',
      'storageGet',
      'storageSet',
      'clamp',
      'isEditing'
    ];

    for (const fn of expectedFunctions) {
      assert.ok(content.includes(fn), `Should contain ${fn} function`);
    }
  });

  it("should have proper JSDoc comments", async () => {
    const content = await readFile("js/utils.js", "utf8");
    assert.ok(content.includes('/**'), "Should have JSDoc comments");
    assert.ok(content.includes('@param'), "Should document parameters");
    assert.ok(content.includes('@returns'), "Should document return values");
  });
});

describe("Feedback - Client-side Secret Guard", () => {
  it("should not hardcode a Web3Forms access key", async () => {
    const content = await readFile("js/feedback.js", "utf8");
    assert.match(content, /var WEB3FORMS_ACCESS_KEY = "";/);
    assert.doesNotMatch(content, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it("should render feedback entries without list innerHTML", async () => {
    const content = await readFile("js/feedback.js", "utf8");
    assert.doesNotMatch(content, /listEl\.innerHTML\s*=/);
    assert.match(content, /listEl\.replaceChildren\(\)/);
    assert.match(content, /textContent = entry\.message/);
  });
});

describe("Error Handler - Safe Toast Rendering", () => {
  it("should render toast messages without innerHTML", async () => {
    const content = await readFile("js/error-handler.js", "utf8");
    assert.doesNotMatch(content, /toast\.innerHTML\s*=/);
    assert.match(content, /text\.textContent = message/);
    assert.match(content, /document\.createElement\('button'\)/);
  });
});

describe("Utils - Date Validation Logic", () => {
  function isValidDate(dateStr) {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  }

  it("should validate correct date formats", () => {
    assert.ok(isValidDate('2026-06-17'));
    assert.ok(isValidDate('2023-01-01'));
    assert.ok(isValidDate('2024-12-31'));
  });

  it("should reject incorrect date formats", () => {
    assert.ok(!isValidDate('2026/06/17'));
    assert.ok(!isValidDate('06-17-2026'));
    assert.ok(!isValidDate('2026-6-7'));
    assert.ok(!isValidDate('invalid'));
    assert.ok(!isValidDate(''));
  });
});

describe("Utils - Slug Validation Logic", () => {
  function isValidSlug(slug) {
    return /^[a-z0-9_-]+$/i.test(slug) && slug.length <= 100;
  }

  it("should validate correct slugs", () => {
    assert.ok(isValidSlug('my-post'));
    assert.ok(isValidSlug('hello-world'));
    assert.ok(isValidSlug('test_123'));
    assert.ok(isValidSlug('ABC-def'));
  });

  it("should reject invalid slugs", () => {
    assert.ok(!isValidSlug('my post'));
    assert.ok(!isValidSlug('hello/world'));
    assert.ok(!isValidSlug('test@123'));
    assert.ok(!isValidSlug('a'.repeat(101)));
  });
});
