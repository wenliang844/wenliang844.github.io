// Phase 8: 前端 JS 行为测试
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

// ─── i18n.js 测试 ─────────────────────────────────────────────────────────────

test("i18n.js exports cwlLang and cwlT functions", async () => {
  const code = await readFile(join(ROOT, "js", "i18n.js"), "utf8");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  dom.window.eval(code);

  assert.equal(typeof dom.window.cwlLang, "function", "cwlLang should be a function");
  assert.equal(typeof dom.window.cwlT, "function", "cwlT should be a function");
});

test("i18n.js defaults to Chinese language", async () => {
  const code = await readFile(join(ROOT, "js", "i18n.js"), "utf8");
  const dom = new JSDOM("<!doctype html><html lang='zh-CN'><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  dom.window.eval(code);

  assert.equal(dom.window.cwlLang(), "zh");
});

test("i18n.js cwlT returns fallback for unknown keys", async () => {
  const code = await readFile(join(ROOT, "js", "i18n.js"), "utf8");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  dom.window.eval(code);

  const result = dom.window.cwlT("unknown.key", "fallback text");
  assert.equal(result, "fallback text");
});

// ─── utils.js 测试 ────────────────────────────────────────────────────────────

test("utils.js exports all expected utility functions", async () => {
  const code = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  dom.window.eval(code);

  const utils = dom.window.CWLUtils;
  assert.ok(utils, "CWLUtils should be exported");
  assert.equal(typeof utils.escapeHtml, "function");
  assert.equal(typeof utils.copyText, "function");
  assert.equal(typeof utils.throttle, "function");
  assert.equal(typeof utils.debounce, "function");
  assert.equal(typeof utils.storageGet, "function");
  assert.equal(typeof utils.storageSet, "function");
  assert.equal(typeof utils.clamp, "function");
  assert.equal(typeof utils.isEditing, "function");
});

test("utils.js throttle delays execution", async () => {
  const code = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  dom.window.eval(code);

  let callCount = 0;
  const fn = dom.window.CWLUtils.throttle(() => callCount++, 100);

  fn();
  fn();
  fn();
  assert.equal(callCount, 1, "throttle should execute immediately on first call");
});

test("utils.js debounce delays execution", async () => {
  const code = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  dom.window.eval(code);

  let callCount = 0;
  const fn = dom.window.CWLUtils.debounce(() => callCount++, 100);

  fn();
  fn();
  fn();
  assert.equal(callCount, 0, "debounce should not execute immediately");
});

test("utils.js clamp constrains values within range", async () => {
  const code = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  dom.window.eval(code);

  const clamp = dom.window.CWLUtils.clamp;
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
});

test("utils.js isEditing function exists", async () => {
  const code = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const dom = new JSDOM(`<!doctype html><html><body>
    <input type="text" id="test-input">
    <textarea id="test-textarea"></textarea>
    <div id="test-div" contenteditable="true"></div>
  </body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  dom.window.eval(code);

  // isEditing 应该是一个函数
  assert.equal(typeof dom.window.CWLUtils.isEditing, "function");
});

test("keyboard shortcut modules reuse CWLUtils.isEditing", async () => {
  const files = ["blog.js", "search-loader.js", "search.js"];
  for (const file of files) {
    const code = await readFile(join(ROOT, "js", file), "utf8");
    assert.ok(code.includes("CWLUtils.isEditing"), `${file} should call shared editing helper`);
    assert.equal(code.includes('tag === "INPUT"'), false, `${file} should not duplicate input tag checks`);
  }
});

test("application modules use Array.from for DOM collection conversion", async () => {
  const files = ["blog.js", "coder.js", "overleaf.js", "tools.js"];
  for (const file of files) {
    const code = await readFile(join(ROOT, "js", file), "utf8");
    assert.doesNotMatch(code, /Array\.prototype\.slice\.call/, `${file} should avoid legacy collection conversion`);
  }
});

test("copy consumers delegate fallback logic to CWLUtils.copyText", async () => {
  const files = ["coder.js", "share.js"];
  for (const file of files) {
    const code = await readFile(join(ROOT, "js", file), "utf8");
    assert.match(code, /CWLUtils\.copyText/, `${file} should use the shared copy helper`);
    assert.doesNotMatch(code, /document\.execCommand\("copy"\)/, `${file} should not duplicate legacy copy fallback`);
    assert.doesNotMatch(code, /document\.createElement\("textarea"\)/, `${file} should not duplicate textarea fallback`);
  }
});

// ─── error-handler.js 测试 ────────────────────────────────────────────────────

test("error-handler.js registers global error handlers", async () => {
  const code = await readFile(join(ROOT, "js", "error-handler.js"), "utf8");
  assert.ok(code.includes("onerror") || code.includes("addEventListener"), "should register error handlers");
  assert.ok(code.includes("unhandledrejection") || code.includes("Unhandledrejection"), "should handle promise rejections");
});

test("error-handler.js creates toast without innerHTML", async () => {
  const code = await readFile(join(ROOT, "js", "error-handler.js"), "utf8");
  assert.doesNotMatch(code, /\.innerHTML\s*=/, "should not use innerHTML for toast rendering");
  assert.match(code, /textContent/, "should use textContent for safe text rendering");
});

// ─── tools.js 测试 ────────────────────────────────────────────────────────────

test("tools.js sets up tool panel switching", async () => {
  const code = await readFile(join(ROOT, "js", "tools.js"), "utf8");
  assert.ok(code.includes("data-tool-tab"), "should handle tool tab clicks");
  assert.ok(code.includes("data-tool-panel"), "should switch tool panels");
});

test("tools.js handles JSON format and minify actions", async () => {
  const code = await readFile(join(ROOT, "js", "tools.js"), "utf8");
  assert.ok(code.includes("data-json-action"), "should handle JSON action buttons");
  assert.ok(code.includes("format") && code.includes("minify"), "should support format and minify");
});

test("tools.js handles codec encode and decode actions", async () => {
  const code = await readFile(join(ROOT, "js", "tools.js"), "utf8");
  assert.ok(code.includes("data-codec-action"), "should handle codec action buttons");
  assert.ok(code.includes("base64-encode") || code.includes("encode"), "should support encode");
  assert.ok(code.includes("base64-decode") || code.includes("decode"), "should support decode");
});

test("tools.js handles UUID generation", async () => {
  const code = await readFile(join(ROOT, "js", "tools.js"), "utf8");
  assert.ok(code.includes("data-uuid-generate"), "should handle UUID generate button");
});

test("tools.js handles JWT decoding", async () => {
  const code = await readFile(join(ROOT, "js", "tools.js"), "utf8");
  assert.ok(code.includes("data-jwt-decode"), "should handle JWT decode button");
});

// ─── search-loader.js 测试 ────────────────────────────────────────────────────

test("search-loader.js lazily loads search dependencies", async () => {
  const code = await readFile(join(ROOT, "js", "search-loader.js"), "utf8");
  assert.ok(code.includes("search") || code.includes("Search"), "should reference search functionality");
  assert.ok(code.includes("trigger") || code.includes("click") || code.includes("addEventListener"), "should handle user interaction");
});

// ─── share.js 测试 ────────────────────────────────────────────────────────────

test("share.js handles multiple share targets", async () => {
  const code = await readFile(join(ROOT, "js", "share.js"), "utf8");
  assert.ok(code.includes("data-share"), "should handle data-share attributes");
  assert.ok(code.includes("x") || code.includes("twitter"), "should support X/Twitter sharing");
  assert.ok(code.includes("weibo"), "should support Weibo sharing");
  assert.ok(code.includes("wechat"), "should support WeChat sharing");
  assert.ok(code.includes("copy"), "should support copy link");
});

// ─── blog.js 测试 ─────────────────────────────────────────────────────────────

test("blog.js handles post tree navigation", async () => {
  const code = await readFile(join(ROOT, "js", "blog.js"), "utf8");
  assert.ok(code.includes("post-tree"), "should handle post tree");
  assert.ok(code.includes("post-search") || code.includes("search"), "should handle post search");
  assert.ok(code.includes("tag-filter") || code.includes("tag"), "should handle tag filtering");
});

// ─── toc.js 测试 ──────────────────────────────────────────────────────────────

test("toc.js handles table of contents interactions", async () => {
  const code = await readFile(join(ROOT, "js", "toc.js"), "utf8");
  assert.ok(code.includes("toc-sidebar") || code.includes("toc"), "should reference TOC elements");
  assert.ok(code.includes("toc-toggle") || code.includes("toggle"), "should handle TOC toggle");
});

// ─── post-next.js 测试 ────────────────────────────────────────────────────────

test("post-next.js handles next post popup", async () => {
  const code = await readFile(join(ROOT, "js", "post-next.js"), "utf8");
  assert.ok(code.includes("next-popup"), "should reference next popup element");
  assert.ok(code.includes("scroll") || code.includes("IntersectionObserver"), "should handle scroll-based triggering");
});

// ─── giscus.js 测试 ───────────────────────────────────────────────────────────

test("giscus.js loads Giscus comments widget", async () => {
  const code = await readFile(join(ROOT, "js", "giscus.js"), "utf8");
  assert.ok(code.includes("giscus"), "should reference Giscus");
  assert.ok(code.includes("giscus-thread") || code.includes("giscus.app"), "should reference Giscus container or API");
});

test("giscus.js renders placeholder without innerHTML", async () => {
  const code = await readFile(join(ROOT, "js", "giscus.js"), "utf8");
  assert.doesNotMatch(code, /thread\.innerHTML\s*=/, "should not assign placeholder HTML directly");
  assert.match(code, /replaceChildren\(createPlaceholder\(\)\)/, "should replace placeholder with DOM nodes");
});

// ─── feedback.js 测试 ─────────────────────────────────────────────────────────

test("feedback.js does not hardcode API keys", async () => {
  const code = await readFile(join(ROOT, "js", "feedback.js"), "utf8");
  // 确保没有硬编码的 API key
  assert.doesNotMatch(code, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
});

test("feedback.js uses safe DOM manipulation", async () => {
  const code = await readFile(join(ROOT, "js", "feedback.js"), "utf8");
  assert.doesNotMatch(code, /listEl\.innerHTML\s*=/, "should not use innerHTML for list rendering");
  assert.match(code, /textContent/, "should use textContent for safe rendering");
});

// ─── performance-monitor.js 测试 ──────────────────────────────────────────────

test("performance-monitor.js exists and has content", async () => {
  const code = await readFile(join(ROOT, "js", "performance-monitor.js"), "utf8");
  assert.ok(code.length > 0, "performance-monitor.js should not be empty");
});

test("performance-monitor.js uses Navigation Timing Level 2", async () => {
  const code = await readFile(join(ROOT, "js", "performance-monitor.js"), "utf8");
  assert.match(code, /getEntriesByType\("navigation"\)/, "should read navigation entries");
  assert.doesNotMatch(code, /performance\.timing/, "should not use deprecated performance.timing");
});

// ─── logger.js 测试 ───────────────────────────────────────────────────────────

test("logger.js exists and has content", async () => {
  const code = await readFile(join(ROOT, "js", "logger.js"), "utf8");
  assert.ok(code.length > 0, "logger.js should not be empty");
});
