// 行为测试: highlight-loader.js — 代码高亮懒加载
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

function buildHighlightHtml(hasCodeBlocks = true) {
  if (hasCodeBlocks) {
    return `<!doctype html><html><body>
    <pre><code class="language-javascript">console.log("hello");</code></pre>
    <pre><code class="language-python">print("world")</code></pre>
    <pre><code>plain code</code></pre>
    </body></html>`;
  }
  return "<!doctype html><html><body><p>No code blocks here</p></body></html>";
}

async function loadHighlightLoader(dom) {
  const code = await readFile(join(ROOT, "js", "highlight-loader.js"), "utf8");
  dom.window.eval(code);
  return dom;
}

// ─── 无代码块时跳过加载 ────────────────────────────────────────────────────────

test("highlight-loader skips loading when no code blocks exist", async () => {
  const dom = new JSDOM(buildHighlightHtml(false), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  await loadHighlightLoader(dom);

  const scripts = dom.window.document.querySelectorAll('script[src*="highlight"]');
  assert.equal(scripts.length, 0, "should not load highlight.js when no code blocks");

  dom.window.close();
});

// ─── 有代码块时加载 highlight.js ───────────────────────────────────────────────

test("highlight-loader loads highlight.js when code blocks exist", async () => {
  const dom = new JSDOM(buildHighlightHtml(true), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  await loadHighlightLoader(dom);

  const script = dom.window.document.querySelector('script[src="/js/vendor/highlight.min.js"]');
  assert.ok(script, "highlight.js script should be appended");
  assert.equal(script.async, true, "script should be async");

  dom.window.close();
});

// ─── 已加载 hljs 时跳过 ───────────────────────────────────────────────────────

test("highlight-loader skips loading when hljs already exists", async () => {
  const dom = new JSDOM(buildHighlightHtml(true), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  // Pre-set hljs
  dom.window.hljs = { configure: function () {}, highlightElement: function () {} };

  await loadHighlightLoader(dom);

  const scripts = dom.window.document.querySelectorAll('script[src*="highlight"]');
  assert.equal(scripts.length, 0, "should not load highlight.js when already present");

  dom.window.close();
});

// ─── onload 配置和高亮 ─────────────────────────────────────────────────────────

test("highlight-loader configures and highlights on load", async () => {
  let scriptOnload = null;
  const dom = new JSDOM(buildHighlightHtml(true), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  // Intercept script creation
  const origCreate = dom.window.document.createElement.bind(dom.window.document);
  dom.window.document.createElement = function (tag) {
    const el = origCreate(tag);
    if (tag === "script") {
      Object.defineProperty(el, "onload", {
        set: function (fn) { scriptOnload = fn; },
        get: function () { return scriptOnload; },
      });
    }
    return el;
  };

  await loadHighlightLoader(dom);
  assert.ok(scriptOnload, "onload handler should be set");

  // Simulate hljs being available
  let configureOpts = null;
  const highlightedBlocks = [];
  dom.window.hljs = {
    configure: function (opts) { configureOpts = opts; },
    highlightElement: function (el) { highlightedBlocks.push(el); },
  };

  scriptOnload();

  assert.ok(configureOpts, "hljs.configure should be called");
  assert.equal(configureOpts.ignoreUnescapedHTML, true);
  assert.ok(Array.isArray(configureOpts.languages), "languages should be an array");
  assert.ok(configureOpts.languages.includes("javascript"), "should include javascript");
  assert.ok(configureOpts.languages.includes("python"), "should include python");
  assert.ok(configureOpts.languages.includes("java"), "should include java");

  // All 3 code blocks should be highlighted
  assert.equal(highlightedBlocks.length, 3, "all code blocks should be highlighted");

  dom.window.close();
});

// ─── onload 中 hljs 不存在时安全退出 ───────────────────────────────────────────

test("highlight-loader exits safely when hljs not available after script load", async () => {
  let scriptOnload = null;
  const dom = new JSDOM(buildHighlightHtml(true), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  const origCreate = dom.window.document.createElement.bind(dom.window.document);
  dom.window.document.createElement = function (tag) {
    const el = origCreate(tag);
    if (tag === "script") {
      Object.defineProperty(el, "onload", {
        set: function (fn) { scriptOnload = fn; },
        get: function () { return scriptOnload; },
      });
    }
    return el;
  };

  await loadHighlightLoader(dom);

  // Simulate script load but hljs not set
  // Should not throw
  scriptOnload();
  assert.ok(true, "should handle missing hljs gracefully");

  dom.window.close();
});

// ─── highlightElement 异常捕获 ─────────────────────────────────────────────────

test("highlight-loader catches errors in highlightElement", async () => {
  let scriptOnload = null;
  const dom = new JSDOM(buildHighlightHtml(true), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  const origCreate = dom.window.document.createElement.bind(dom.window.document);
  dom.window.document.createElement = function (tag) {
    const el = origCreate(tag);
    if (tag === "script") {
      Object.defineProperty(el, "onload", {
        set: function (fn) { scriptOnload = fn; },
        get: function () { return scriptOnload; },
      });
    }
    return el;
  };

  // Suppress console.warn
  const origWarn = console.warn;
  console.warn = function () {};

  await loadHighlightLoader(dom);

  dom.window.hljs = {
    configure: function () {},
    highlightElement: function () { throw new Error("highlight failed"); },
  };

  // Should not throw even though highlightElement throws
  scriptOnload();
  assert.ok(true, "should catch highlightElement errors");

  console.warn = origWarn;
  dom.window.close();
});

// ─── onerror 处理 ──────────────────────────────────────────────────────────────

test("highlight-loader has onerror handler for script load failure", async () => {
  let scriptOnerror = null;
  const dom = new JSDOM(buildHighlightHtml(true), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  const origCreate = dom.window.document.createElement.bind(dom.window.document);
  dom.window.document.createElement = function (tag) {
    const el = origCreate(tag);
    if (tag === "script") {
      Object.defineProperty(el, "onerror", {
        set: function (fn) { scriptOnerror = fn; },
        get: function () { return scriptOnerror; },
      });
    }
    return el;
  };

  const origWarn = console.warn;
  let warnMsg = null;
  console.warn = function (msg) { warnMsg = msg; };

  await loadHighlightLoader(dom);
  assert.ok(scriptOnerror, "onerror handler should be set");

  // Simulate load failure
  scriptOnerror();
  assert.ok(warnMsg && warnMsg.includes("highlight"), "should warn about load failure");

  console.warn = origWarn;
  dom.window.close();
});
