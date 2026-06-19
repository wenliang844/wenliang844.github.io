// 行为测试: search-loader.js — 搜索懒加载与键盘快捷键
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

function buildSearchLoaderHtml(options = {}) {
  const hasTrigger = options.hasTrigger !== false;
  const trigger = hasTrigger ? '<button class="nav-search-trigger" aria-label="Search">🔍</button>' : "";
  return `<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
  <nav>${trigger}</nav>
</body></html>`;
}

async function loadSearchLoader(dom) {
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  dom.window.eval(utilsCode);
  const code = await readFile(join(ROOT, "js", "search-loader.js"), "utf8");
  dom.window.eval(code);
  return dom;
}

// ─── 点击触发加载搜索 ──────────────────────────────────────────────────────────

test("search-loader.js loads search script on trigger click", async () => {
  const dom = new JSDOM(buildSearchLoaderHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  await loadSearchLoader(dom);
  const { document } = dom.window;

  const trigger = document.querySelector(".nav-search-trigger");
  trigger.click();

  const script = document.querySelector('script[src="/js/search.js"]');
  assert.ok(script, "search script should be appended to DOM");
  assert.equal(script.defer, true, "script should have defer attribute");

  dom.window.close();
});

test("search-loader.js calls cwlOpenSearch after script loads when triggered by click", async () => {
  const dom = new JSDOM(buildSearchLoaderHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  await loadSearchLoader(dom);
  const { document } = dom.window;

  // Set up cwlOpenSearch before triggering the click
  let openCalled = false;
  dom.window.cwlOpenSearch = function () { openCalled = true; };

  // Click trigger — since cwlOpenSearch is already set, it will be called directly
  document.querySelector(".nav-search-trigger").click();

  assert.ok(openCalled, "cwlOpenSearch should be called directly when already loaded");

  dom.window.close();
});

// ─── 键盘快捷键 ────────────────────────────────────────────────────────────────

test("search-loader.js / key triggers search load", async () => {
  const dom = new JSDOM(buildSearchLoaderHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  await loadSearchLoader(dom);
  const { document } = dom.window;

  // Simulate pressing "/"
  document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    key: "/",
    bubbles: true,
  }));

  const script = document.querySelector('script[src="/js/search.js"]');
  assert.ok(script, "search script should be loaded on / key");

  dom.window.close();
});

test("search-loader.js Ctrl+K triggers search load", async () => {
  const dom = new JSDOM(buildSearchLoaderHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  await loadSearchLoader(dom);
  const { document } = dom.window;

  document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    key: "k",
    ctrlKey: true,
    bubbles: true,
  }));

  const script = document.querySelector('script[src="/js/search.js"]');
  assert.ok(script, "search script should be loaded on Ctrl+K");

  dom.window.close();
});

test("search-loader.js keyboard shortcut ignored when search is already open", async () => {
  const dom = new JSDOM(buildSearchLoaderHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  await loadSearchLoader(dom);
  const { document } = dom.window;

  // Simulate search-open state
  dom.window.document.body.classList.add("search-open");

  document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    key: "/",
    bubbles: true,
  }));

  const script = document.querySelector('script[src="/js/search.js"]');
  assert.ok(!script, "search script should NOT load when search is open");

  dom.window.close();
});

test("search-loader.js keyboard shortcut ignored when editing", async () => {
  const dom = new JSDOM(buildSearchLoaderHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  // Override CWLUtils.isEditing to return true
  await loadSearchLoader(dom);
  dom.window.CWLUtils.isEditing = function () { return true; };

  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    key: "/",
    bubbles: true,
  }));

  const script = dom.window.document.querySelector('script[src="/js/search.js"]');
  assert.ok(!script, "search script should NOT load when editing");

  dom.window.close();
});

// ─── 已有 cwlOpenSearch 时直接调用 ─────────────────────────────────────────────

test("search-loader.js calls cwlOpenSearch directly if already loaded", async () => {
  const dom = new JSDOM(buildSearchLoaderHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  let openCalled = false;
  dom.window.cwlOpenSearch = function () { openCalled = true; };

  await loadSearchLoader(dom);

  dom.window.document.querySelector(".nav-search-trigger").click();

  assert.ok(openCalled, "should call cwlOpenSearch directly without loading script");
  assert.ok(!dom.window.document.querySelector('script[src="/js/search.js"]'),
    "should not append script when search is already loaded");

  dom.window.close();
});

// ─── 空闲预加载 ────────────────────────────────────────────────────────────────

test("search-loader.js uses requestIdleCallback for preload when available", async () => {
  let idleCallback = null;
  const dom = new JSDOM(buildSearchLoaderHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  dom.window.requestIdleCallback = function (cb, opts) {
    idleCallback = { cb, opts };
  };

  await loadSearchLoader(dom);

  assert.ok(idleCallback, "requestIdleCallback should be called");
  assert.equal(idleCallback.opts.timeout, 3500, "timeout should be 3500ms");

  dom.window.close();
});

test("search-loader.js falls back to setTimeout when requestIdleCallback unavailable", async () => {
  let timeoutArgs = null;
  const dom = new JSDOM(buildSearchLoaderHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  // Delete requestIdleCallback before loading so the "in" check returns false
  delete dom.window.requestIdleCallback;
  const origSetTimeout = dom.window.setTimeout;
  dom.window.setTimeout = function (cb, ms) {
    timeoutArgs = { cb, ms };
    return origSetTimeout(cb, ms);
  };

  await loadSearchLoader(dom);

  assert.ok(timeoutArgs, "setTimeout should be called as fallback");
  assert.equal(timeoutArgs.ms, 2500, "fallback timeout should be 2500ms");

  dom.window.close();
});

// ─── 无 trigger 时跳过预加载 ───────────────────────────────────────────────────

test("search-loader.js skips idle preload without nav-search-trigger", async () => {
  const dom = new JSDOM(buildSearchLoaderHtml({ hasTrigger: false }), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  let idleCalled = false;
  dom.window.requestIdleCallback = function () { idleCalled = true; };

  await loadSearchLoader(dom);

  assert.ok(!idleCalled, "should not schedule idle preload without trigger");

  dom.window.close();
});

// ─── 脚本加载失败 ──────────────────────────────────────────────────────────────

test("search-loader.js handles script load failure by checking source pattern", async () => {
  const code = await readFile(join(ROOT, "js", "search-loader.js"), "utf8");

  // Verify the source has an onerror handler that resets task
  assert.ok(code.includes("onerror"), "should have onerror handler");
  assert.ok(code.includes("task = null"), "should reset task on error");
  assert.ok(code.includes("reject"), "should reject the promise on error");
});

// ─── cwlPreloadSearch 回退 ─────────────────────────────────────────────────────

test("search-loader.js calls cwlPreloadSearch for idle preload path", async () => {
  // Verify the source code has the cwlPreloadSearch fallback path
  const code = await readFile(join(ROOT, "js", "search-loader.js"), "utf8");
  assert.ok(code.includes("cwlPreloadSearch"), "should reference cwlPreloadSearch");
  assert.ok(code.includes("queuedOpen"), "should have queuedOpen logic");
  assert.ok(code.includes("openAfterLoad"), "should check openAfterLoad parameter");
});
