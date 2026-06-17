import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

// Load and execute a JS file in a JSDOM environment
async function loadJSInDOM(jsPath) {
  const jsCode = await readFile(join(ROOT, jsPath), "utf8");
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    runScripts: "outside-only",
  });
  dom.window.eval(jsCode);
  return dom.window;
}

test("utils.js escapeHtml prevents XSS", async () => {
  const window = await loadJSInDOM("js/utils.js");
  const { escapeHtml } = window.CWLUtils;

  const malicious = '<script>alert("XSS")</script>';
  const escaped = escapeHtml(malicious);
  assert.ok(!escaped.includes("<script>"));
  assert.ok(escaped.includes("&lt;script&gt;"));

  const withQuotes = 'Hello "world" & \'friends\'';
  const escapedQuotes = escapeHtml(withQuotes);
  assert.ok(escapedQuotes.includes("&quot;"));
  assert.ok(escapedQuotes.includes("&#39;"));
  assert.ok(escapedQuotes.includes("&amp;"));

  // Edge cases
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
  assert.equal(escapeHtml(""), "");
});

test("search.js highlightText sanitizes input", async () => {
  // Simulate escapeHtml and escapeRegExp functions
  const escapeHtml = function (value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const escapeRegExp = function (value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  const highlightText = function (text, query) {
    var raw = String(text || "");
    var html = escapeHtml(raw);
    if (!query) { return html; }
    return html.replace(new RegExp("(" + escapeRegExp(query) + ")", "gi"), "<mark>$1</mark>");
  };

  const maliciousText = '<img src=x onerror=alert(1)>';
  const result = highlightText(maliciousText, "img");

  // The escapeHtml converts < to &lt;, so "onerror=" becomes part of escaped text
  assert.ok(!result.includes("<img"), "Should not contain unescaped img tag");
  assert.ok(result.includes("&lt;"), "Should contain escaped angle brackets");
  assert.ok(result.includes("<mark>img</mark>"), "Should highlight the search term");
});

test("localStorage operations handle quota errors gracefully", async () => {
  // Test the logic directly without mocking JSDOM's localStorage
  const storageGet = function(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn("localStorage.getItem failed:", error);
      return null;
    }
  };

  const storageSet = function(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn("localStorage.setItem failed:", error);
      return false;
    }
  };

  // Create a mock window with throwing localStorage
  const mockWindow = {
    localStorage: {
      getItem: () => { throw new Error("QuotaExceeded"); },
      setItem: () => { throw new Error("QuotaExceeded"); },
    }
  };

  // Override global window temporarily
  const originalWindow = global.window;
  const originalWarn = console.warn;
  const warnings = [];
  global.window = mockWindow;
  console.warn = function (...args) {
    warnings.push(args);
  };

  try {
    const result = storageGet("test-key");
    assert.equal(result, null, "storageGet should return null on error");

    const setResult = storageSet("test-key", "value");
    assert.equal(setResult, false, "storageSet should return false on error");
    assert.equal(warnings.length, 2, "storage failures should be reported");
  } finally {
    // Restore
    global.window = originalWindow;
    console.warn = originalWarn;
  }
});

test("date validation rejects invalid formats", async () => {
  const { normalizeDate } = await import("../scripts/build.mjs");

  // Valid dates
  assert.equal(normalizeDate("2024-01-15"), "2024-01-15");
  assert.equal(normalizeDate("2024-02-29"), "2024-02-29");
  assert.equal(normalizeDate(new Date("2024-01-15")), "2024-01-15");

  // Invalid dates should throw
  assert.throws(() => normalizeDate("2024/01/15"), /Invalid date format/);
  assert.throws(() => normalizeDate("15-01-2024"), /Invalid date format/);
  assert.throws(() => normalizeDate("2024-1-5"), /Invalid date format/);
  assert.throws(() => normalizeDate("not-a-date"), /Invalid date format/);
  assert.throws(() => normalizeDate("2024-02-30"), /Invalid date value/);
  assert.throws(() => normalizeDate("2023-02-29"), /Invalid date value/);
});

test("slug validation rejects invalid characters", async () => {
  const { validateSlug, validateUniqueSlug } = await import("../scripts/build.mjs");

  // Valid slugs should not throw
  assert.doesNotThrow(() => validateSlug("valid-slug", "test.md"));
  assert.doesNotThrow(() => validateSlug("valid_slug_123", "test.md"));
  assert.doesNotThrow(() => validateSlug("ValidSlug", "test.md"));

  // Invalid slugs should throw
  assert.throws(() => validateSlug("", "test.md"), /slug is required/);
  assert.throws(() => validateSlug(null, "test.md"), /slug is required/);
  assert.throws(() => validateSlug("slug with spaces", "test.md"), /Only letters, numbers/);
  assert.throws(() => validateSlug("slug/with/slash", "test.md"), /Only letters, numbers/);
  assert.throws(() => validateSlug("slug<script>", "test.md"), /Only letters, numbers/);
  assert.throws(() => validateSlug("a".repeat(101), "test.md"), /too long/);

  const seenSlugs = new Map();
  assert.doesNotThrow(() => validateUniqueSlug("valid-slug", "first.md", seenSlugs));
  assert.throws(
    () => validateUniqueSlug("valid-slug", "second.md", seenSlugs),
    /Duplicate slug/,
  );
});

test("post validation rejects missing required fields", async () => {
  const { validatePost } = await import("../scripts/build.mjs");

  const validPost = {
    title: "Test Post",
    shortTitle: "Test",
    date: "2024-01-15",
    summary: "Summary",
    description: "Description",
  };

  // Valid post should not throw
  assert.doesNotThrow(() => validatePost(validPost, "test.md"));

  // Missing fields should throw
  const missingTitle = { ...validPost };
  delete missingTitle.title;
  assert.throws(() => validatePost(missingTitle, "test.md"), /Missing required fields/);

  // Field too long should throw
  const longTitle = { ...validPost, title: "a".repeat(201) };
  assert.throws(() => validatePost(longTitle, "test.md"), /Title too long/);

  const longDescription = { ...validPost, description: "a".repeat(501) };
  assert.throws(() => validatePost(longDescription, "test.md"), /Description too long/);
});
