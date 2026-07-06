// Deep test: utils.js — throttle, debounce, copyText, storage, clamp, isEditing
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { escapeHtml as sharedEscapeHtml } from "../src/lib/format.mjs";
import { readingMinutes as sharedReadingMinutes } from "../src/lib/reading.mjs";

const ROOT = join(import.meta.dirname, "..");

async function loadUtils(dom) {
  const code = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  dom.window.eval(code);
  return dom;
}

// ─── clamp 基本功能 ────────────────────────────────────────────────────────

test("utils.js clamp returns value within range", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadUtils(dom);
  const { clamp } = dom.window.CWLUtils;

  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp(0, 0, 10), 0);
  assert.equal(clamp(10, 0, 10), 10);
  dom.window.close();
});

test("utils.js clamp handles negative ranges", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadUtils(dom);
  const { clamp } = dom.window.CWLUtils;

  assert.equal(clamp(0, -10, -1), -1);
  assert.equal(clamp(-5, -10, -1), -5);
  assert.equal(clamp(-15, -10, -1), -10);
  dom.window.close();
});

test("utils.js clamp handles equal min and max", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadUtils(dom);
  const { clamp } = dom.window.CWLUtils;

  assert.equal(clamp(5, 3, 3), 3);
  assert.equal(clamp(3, 3, 3), 3);
  dom.window.close();
});

// ─── escapeHtml 完整覆盖 ───────────────────────────────────────────────────

test("utils.js escapeHtml handles all special characters", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadUtils(dom);
  const { escapeHtml } = dom.window.CWLUtils;

  assert.equal(escapeHtml("&"), "&amp;");
  assert.equal(escapeHtml("<"), "&lt;");
  assert.equal(escapeHtml(">"), "&gt;");
  assert.equal(escapeHtml('"'), "&quot;");
  assert.equal(escapeHtml("'"), "&#39;");
  assert.equal(escapeHtml(""), "");
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
  assert.equal(escapeHtml(0), "0");
  assert.equal(escapeHtml(false), "false");
  dom.window.close();
});

test("utils.js escapeHtml handles complex XSS vectors", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadUtils(dom);
  const { escapeHtml } = dom.window.CWLUtils;

  const xssVectors = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert(1)>',
    '"><script>alert(1)</script>',
    "javascript:alert(1)",
    '<svg onload=alert(1)>',
    '{{constructor.constructor("return this")()}}',
  ];

  for (const vector of xssVectors) {
    const escaped = escapeHtml(vector);
    assert.ok(!escaped.includes("<script>"), `should escape script tags in: ${vector}`);
    assert.ok(!escaped.includes("<img"), `should escape img tags in: ${vector}`);
    assert.ok(!escaped.includes("<svg"), `should escape svg tags in: ${vector}`);
  }
  dom.window.close();
});

test("utils.js escapeHtml matches the shared server formatter", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadUtils(dom);
  const { escapeHtml } = dom.window.CWLUtils;

  const fixtures = [
    "",
    null,
    undefined,
    0,
    false,
    "plain text",
    "Tom & Jerry",
    `<script>alert("XSS&'")</script>`,
    "中文 mixed <tag> & \"quote\" 'single'",
  ];

  for (const fixture of fixtures) {
    assert.equal(escapeHtml(fixture), sharedEscapeHtml(fixture));
  }
  dom.window.close();
});

test("utils.js readingMinutes matches the shared server helper", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadUtils(dom);
  const { readingMinutes } = dom.window.CWLUtils;

  const fixtures = [
    "",
    "   ...   !!!   ???   ",
    "中".repeat(700),
    "word ".repeat(400).trim(),
    "中文 content mixed ".repeat(80),
    "代码块 function test() { return 1; } 以及 English words",
  ];

  for (const fixture of fixtures) {
    assert.equal(readingMinutes(fixture), sharedReadingMinutes(fixture));
  }
  dom.window.close();
});

// ─── t 国际化兜底 ───────────────────────────────────────────────────────────

test("utils.js t delegates to cwlT and falls back when unavailable", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadUtils(dom);

  assert.equal(dom.window.CWLUtils.t("missing.key", "兜底文案"), "兜底文案");

  dom.window.cwlT = (key, fallback) => key === "known.key" ? "Translated" : fallback;
  assert.equal(dom.window.CWLUtils.t("known.key", "Fallback"), "Translated");
  assert.equal(dom.window.CWLUtils.t("other.key", "Fallback"), "Fallback");
  dom.window.close();
});

// ─── isEditing 检测 ────────────────────────────────────────────────────────

test("utils.js isEditing detects input/textarea/select focus", async () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <input type="text" id="inp">
    <textarea id="ta"></textarea>
    <select id="sel"><option>1</option></select>
  </body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadUtils(dom);
  const { document } = dom.window;
  const { isEditing } = dom.window.CWLUtils;

  // input 获焦 → 应返回 true
  document.getElementById("inp").focus();
  assert.equal(isEditing(), true, "should detect input focus");

  // textarea 获焦 → 应返回 true
  document.getElementById("ta").focus();
  assert.equal(isEditing(), true, "should detect textarea focus");

  // select 获焦 → 应返回 true
  document.getElementById("sel").focus();
  assert.equal(isEditing(), true, "should detect select focus");
  dom.window.close();
});

// ─── isEditing 无 activeElement 时返回 false ────────────────────────────────

test("utils.js isEditing returns falsy when no input has focus", async () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="plain">plain</div>
  </body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadUtils(dom);
  const { isEditing } = dom.window.CWLUtils;

  // 没有任何 input/textarea/select 获焦时应返回 falsy
  // JSDOM 中 isContentEditable 未完全实现，函数可能隐式返回 undefined
  // 两者都是 falsy，满足 !isEditing() 保护条件
  assert.ok(!isEditing(), "should return falsy when no editing element has focus");
  dom.window.close();
});

// ─── isEditing 函数包含所有必要检查 ──────────────────────────────────────────

test("utils.js isEditing checks INPUT, TEXTAREA, SELECT and isContentEditable", async () => {
  const code = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  assert.ok(code.includes("INPUT"), "should check for INPUT tag");
  assert.ok(code.includes("TEXTAREA"), "should check for TEXTAREA tag");
  assert.ok(code.includes("SELECT"), "should check for SELECT tag");
  assert.ok(code.includes("isContentEditable"), "should check isContentEditable");
});

// ─── storageGet / storageSet ────────────────────────────────────────────────

test("utils.js storageGet returns null for missing keys", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadUtils(dom);
  const { storageGet } = dom.window.CWLUtils;

  assert.equal(storageGet("nonexistent-key-12345"), null);
  dom.window.close();
});

test("utils.js storageSet and storageGet round-trip", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadUtils(dom);
  const { storageGet, storageSet } = dom.window.CWLUtils;

  assert.equal(storageSet("test-key", "hello"), true);
  assert.equal(storageGet("test-key"), "hello");
  dom.window.close();
});

test("utils.js storageGet/Set handle quota errors", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  // 在加载 utils 之前模拟 localStorage 抛出异常
  const originalGetItem = dom.window.Storage.prototype.getItem;
  const originalSetItem = dom.window.Storage.prototype.setItem;
  dom.window.Storage.prototype.getItem = () => { throw new Error("SecurityError"); };
  dom.window.Storage.prototype.setItem = () => { throw new Error("QuotaExceeded"); };

  await loadUtils(dom);
  const { storageGet, storageSet } = dom.window.CWLUtils;

  assert.equal(storageSet("key", "val"), false, "storageSet should return false on error");
  assert.equal(storageGet("key"), null, "storageGet should return null on error");

  // 恢复
  dom.window.Storage.prototype.getItem = originalGetItem;
  dom.window.Storage.prototype.setItem = originalSetItem;
  dom.window.close();
});

// ─── debounce 基本行为 ─────────────────────────────────────────────────────

test("utils.js debounce delays execution", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
    pretendToBeVisual: true,
  });
  await loadUtils(dom);
  const { debounce } = dom.window.CWLUtils;

  let callCount = 0;
  const fn = debounce(() => { callCount++; }, 100);

  fn();
  fn();
  fn();
  assert.equal(callCount, 0, "should not call immediately");

  await new Promise(resolve => dom.window.setTimeout(resolve, 150));
  assert.equal(callCount, 1, "should call once after delay");
  dom.window.close();
});

test("utils.js debounce immediate mode calls right away", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
    pretendToBeVisual: true,
  });
  await loadUtils(dom);
  const { debounce } = dom.window.CWLUtils;

  let callCount = 0;
  const fn = debounce(() => { callCount++; }, 100, true);

  fn();
  assert.equal(callCount, 1, "should call immediately in immediate mode");

  fn();
  assert.equal(callCount, 1, "should not call again during debounce period");

  await new Promise(resolve => dom.window.setTimeout(resolve, 150));
  dom.window.close();
});

// ─── throttle 基本行为 ─────────────────────────────────────────────────────

test("utils.js throttle limits function calls", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
    pretendToBeVisual: true,
  });
  await loadUtils(dom);
  const { throttle } = dom.window.CWLUtils;

  let callCount = 0;
  const fn = throttle(() => { callCount++; }, 100);

  fn(); // 立即执行
  fn(); // 被节流
  fn(); // 被节流
  assert.equal(callCount, 1, "should only call once immediately");

  await new Promise(resolve => dom.window.setTimeout(resolve, 150));
  // 节流期间的最后一次调用应在 timeout 后执行
  assert.equal(callCount, 2, "should call trailing after throttle period");
  dom.window.close();
});

// ─── throttle 保留 this 和 arguments ────────────────────────────────────────

test("utils.js throttle preserves context and arguments", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
    pretendToBeVisual: true,
  });
  await loadUtils(dom);
  const { throttle } = dom.window.CWLUtils;

  const results = [];
  const obj = {
    value: 42,
    fn: throttle(function (x) { results.push(this.value + x); }, 50),
  };

  obj.fn(8);
  assert.deepEqual(results, [50]);
  dom.window.close();
});

// ─── copyText 现代 Clipboard API ───────────────────────────────────────────

test("utils.js copyText uses Clipboard API when available", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadUtils(dom);
  const { copyText } = dom.window.CWLUtils;

  let written = "";
  dom.window.navigator.clipboard = {
    writeText: (text) => { written = text; return Promise.resolve(); },
  };

  await copyText("hello clipboard");
  assert.equal(written, "hello clipboard");
  dom.window.close();
});

// ─── copyText Clipboard API 失败降级 ───────────────────────────────────────

test("utils.js copyText falls back when Clipboard API rejects", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadUtils(dom);
  const { copyText } = dom.window.CWLUtils;

  dom.window.navigator.clipboard = {
    writeText: () => Promise.reject(new Error("not allowed")),
  };
  dom.window.document.execCommand = () => true;

  // 不应抛出异常
  await copyText("test");
  dom.window.close();
});

// ─── legacyCopy 工作机制 ───────────────────────────────────────────────────

test("utils.js legacyCopy creates and removes textarea", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadUtils(dom);
  const { legacyCopy, document } = dom.window.CWLUtils || {};

  // legacyCopy 通过 CWLUtils 暴露
  dom.window.document.execCommand = () => true;
  await dom.window.CWLUtils.legacyCopy("test text");

  // textarea 应该已被移除
  const textareas = dom.window.document.querySelectorAll("textarea");
  assert.equal(textareas.length, 0, "should remove textarea after copy");
  dom.window.close();
});

// ─── copyText 处理 null/undefined ───────────────────────────────────────────

test("utils.js copyText handles null and undefined", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadUtils(dom);

  let written = "";
  dom.window.navigator.clipboard = {
    writeText: (text) => { written = text; return Promise.resolve(); },
  };

  await dom.window.CWLUtils.copyText(null);
  assert.equal(written, "", "null should become empty string");

  await dom.window.CWLUtils.copyText(undefined);
  assert.equal(written, "", "undefined should become empty string");
  dom.window.close();
});

// ─── 全局导出验证 ──────────────────────────────────────────────────────────

test("utils.js exports all expected utilities on CWLUtils", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadUtils(dom);
  const utils = dom.window.CWLUtils;

  assert.equal(typeof utils.escapeHtml, "function");
  assert.equal(typeof utils.copyText, "function");
  assert.equal(typeof utils.legacyCopy, "function");
  assert.equal(typeof utils.throttle, "function");
  assert.equal(typeof utils.debounce, "function");
  assert.equal(typeof utils.storageGet, "function");
  assert.equal(typeof utils.storageSet, "function");
  assert.equal(typeof utils.clamp, "function");
  assert.equal(typeof utils.isEditing, "function");
  assert.equal(typeof utils.t, "function");
  dom.window.close();
});

// ─── debounce reset behavior ────────────────────────────────────────────────

test("utils.js debounce resets timer on repeated calls", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
    pretendToBeVisual: true,
  });
  await loadUtils(dom);
  const { debounce } = dom.window.CWLUtils;

  let callCount = 0;
  const fn = debounce(() => { callCount++; }, 80);

  fn();
  await new Promise(resolve => dom.window.setTimeout(resolve, 30));
  fn(); // reset timer
  await new Promise(resolve => dom.window.setTimeout(resolve, 35));
  assert.equal(callCount, 0, "should still be waiting");

  await new Promise(resolve => dom.window.setTimeout(resolve, 60));
  assert.equal(callCount, 1, "should fire after full delay from last call");
  dom.window.close();
});
