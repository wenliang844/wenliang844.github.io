// Deep test: i18n.js — language switching, DOM application, head update
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

async function loadI18n(dom) {
  const code = await readFile(join(ROOT, "js", "i18n.js"), "utf8");
  dom.window.eval(code);
  return dom;
}

// ─── Language switching ───────────────────────────────────────────────────

test("i18n.js switches textContent elements from Chinese to English and back", async () => {
  const dom = new JSDOM(`<!doctype html><html lang="zh-CN"><head>
    <title>中文标题</title>
    <meta name="description" content="中文描述">
  </head><body data-i18n-page="home">
    <a data-i18n="nav.blog">博客</a>
    <a data-i18n="nav.tools">工具箱</a>
  </body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadI18n(dom);
  const { document } = dom.window;

  // Default should be Chinese
  assert.equal(dom.window.cwlLang(), "zh");
  assert.equal(document.querySelector('[data-i18n="nav.blog"]').textContent, "博客");

  // Switch to English
  dom.window.cwlSetLang("en");
  assert.equal(dom.window.cwlLang(), "en");
  assert.equal(document.querySelector('[data-i18n="nav.blog"]').textContent, "Blog");
  assert.equal(document.querySelector('[data-i18n="nav.tools"]').textContent, "Toolbox");

  // Switch back to Chinese
  dom.window.cwlSetLang("zh");
  assert.equal(dom.window.cwlLang(), "zh");
  assert.equal(document.querySelector('[data-i18n="nav.blog"]').textContent, "博客");
  dom.window.close();
});

// ─── aria-label switching ─────────────────────────────────────────────────

test("i18n.js switches aria-label attributes", async () => {
  const dom = new JSDOM(`<!doctype html><html lang="zh-CN"><head></head><body>
    <button data-i18n-aria="nav.theme" aria-label="切换暗色主题">Theme</button>
  </body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadI18n(dom);
  const { document } = dom.window;

  dom.window.cwlSetLang("en");
  const btn = document.querySelector("[data-i18n-aria]");
  assert.equal(btn.getAttribute("aria-label"), "Toggle dark mode");

  dom.window.cwlSetLang("zh");
  assert.equal(btn.getAttribute("aria-label"), "切换暗色主题");
  dom.window.close();
});

// ─── placeholder switching ────────────────────────────────────────────────

test("i18n.js switches placeholder attributes", async () => {
  const dom = new JSDOM(`<!doctype html><html lang="zh-CN"><head></head><body>
    <input data-i18n-ph="subscribe.ph" placeholder="输入你的邮箱">
  </body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadI18n(dom);
  const { document } = dom.window;

  dom.window.cwlSetLang("en");
  assert.equal(document.querySelector("input").getAttribute("placeholder"), "Enter your email");

  dom.window.cwlSetLang("zh");
  assert.equal(document.querySelector("input").getAttribute("placeholder"), "输入你的邮箱");
  dom.window.close();
});

// ─── html content switching ───────────────────────────────────────────────

test("i18n.js switches innerHTML for data-i18n-html elements", async () => {
  const dom = new JSDOM(`<!doctype html><html lang="zh-CN"><head></head><body>
    <span data-i18n="nav.feedback" data-i18n-html><i class="fas fa-comment-dots" aria-hidden="true"></i> 留言反馈</span>
  </body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadI18n(dom);
  const { document } = dom.window;

  dom.window.cwlSetLang("en");
  const el = document.querySelector("[data-i18n-html]");
  assert.ok(el.innerHTML.includes("Feedback"), "should switch to English HTML");

  dom.window.cwlSetLang("zh");
  assert.ok(el.innerHTML.includes("留言反馈"), "should switch back to Chinese HTML");
  dom.window.close();
});

// ─── Language block visibility ────────────────────────────────────────────

test("i18n.js toggles data-i18n-lang block visibility", async () => {
  const dom = new JSDOM(`<!doctype html><html lang="zh-CN"><head></head><body>
    <div data-i18n-lang="zh">中文内容</div>
    <div data-i18n-lang="en" hidden>English content</div>
  </body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadI18n(dom);
  const { document } = dom.window;

  // Default Chinese: zh block visible, en block hidden
  const zhBlock = document.querySelector('[data-i18n-lang="zh"]');
  const enBlock = document.querySelector('[data-i18n-lang="en"]');
  assert.equal(zhBlock.hidden, false, "zh block should be visible");
  assert.equal(enBlock.hidden, true, "en block should be hidden");

  // Switch to English
  dom.window.cwlSetLang("en");
  assert.equal(zhBlock.hidden, true, "zh block should be hidden");
  assert.equal(enBlock.hidden, false, "en block should be visible");

  // Switch back to Chinese
  dom.window.cwlSetLang("zh");
  assert.equal(zhBlock.hidden, false, "zh block should be visible again");
  assert.equal(enBlock.hidden, true, "en block should be hidden again");
  dom.window.close();
});

// ─── Head title and description update ────────────────────────────────────

test("i18n.js updates <title> and meta description on language switch", async () => {
  const dom = new JSDOM(`<!doctype html><html lang="zh-CN"><head>
    <title>工具箱 :: CWLBlog</title>
    <meta name="description" content="浏览器本地运行的开发工具箱。">
  </head><body data-i18n-page="tools"></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/tools/",
  });
  await loadI18n(dom);
  const { document } = dom.window;

  dom.window.cwlSetLang("en");
  assert.equal(document.title, "Toolbox :: CWLBlog", "title should switch to English");
  const desc = document.querySelector('meta[name="description"]').getAttribute("content");
  assert.ok(desc.includes("Browser-only"), "description should switch to English");

  dom.window.cwlSetLang("zh");
  assert.equal(document.title, "工具箱 :: CWLBlog", "title should switch back to Chinese");
  dom.window.close();
});

// ─── html lang attribute update ───────────────────────────────────────────

test("i18n.js updates html lang attribute", async () => {
  const dom = new JSDOM(`<!doctype html><html lang="zh-CN"><head></head><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadI18n(dom);

  assert.equal(dom.window.document.documentElement.getAttribute("lang"), "zh-CN");

  dom.window.cwlSetLang("en");
  assert.equal(dom.window.document.documentElement.getAttribute("lang"), "en");

  dom.window.cwlSetLang("zh");
  assert.equal(dom.window.document.documentElement.getAttribute("lang"), "zh-CN");
  dom.window.close();
});

// ─── cwl:langchange event ─────────────────────────────────────────────────

test("i18n.js dispatches cwl:langchange event on language switch", async () => {
  const dom = new JSDOM(`<!doctype html><html lang="zh-CN"><head></head><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadI18n(dom);

  let eventFired = false;
  let eventDetail = null;
  dom.window.document.addEventListener("cwl:langchange", (e) => {
    eventFired = true;
    eventDetail = e.detail;
  });

  dom.window.cwlSetLang("en");
  assert.ok(eventFired, "cwl:langchange event should fire");
  assert.equal(eventDetail.lang, "en", "event detail should contain new language");
  dom.window.close();
});

// ─── cwlT function ────────────────────────────────────────────────────────

test("i18n.js cwlT returns English for known keys when in English mode", async () => {
  const dom = new JSDOM(`<!doctype html><html lang="zh-CN"><head></head><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadI18n(dom);

  assert.equal(dom.window.cwlT("nav.blog", "博客"), "博客", "should return fallback in zh mode");

  dom.window.cwlSetLang("en");
  assert.equal(dom.window.cwlT("nav.blog", "博客"), "Blog", "should return English for known key");
  assert.equal(dom.window.cwlT("unknown.key", "fallback"), "fallback", "should return fallback for unknown key");
  dom.window.close();
});

// ─── cwlSetLang toggle via click ──────────────────────────────────────────

test("i18n.js lang toggle button click switches language", async () => {
  const dom = new JSDOM(`<!doctype html><html lang="zh-CN"><head></head><body>
    <button class="lang-toggle">EN</button>
  </body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadI18n(dom);
  const { document } = dom.window;

  const btn = document.querySelector(".lang-toggle");
  assert.equal(dom.window.cwlLang(), "zh");

  btn.click();
  assert.equal(dom.window.cwlLang(), "en", "should switch to English");
  assert.equal(btn.textContent, "中", "button should show 中 for switching to Chinese");

  btn.click();
  assert.equal(dom.window.cwlLang(), "zh", "should switch back to Chinese");
  assert.equal(btn.textContent, "EN", "button should show EN for switching to English");
  dom.window.close();
});

// ─── i18n page body attributes ────────────────────────────────────────────

test("i18n.js reads page-specific head translations from body data attributes", async () => {
  const dom = new JSDOM(`<!doctype html><html lang="zh-CN"><head>
    <title>AI导航 :: CWLBlog</title>
    <meta name="description" content="常用 AI 网站和 AI 工具导航。">
  </head><body data-i18n-page="ai"
    data-i18n-title-en="AI Navigation :: CWLBlog"
    data-i18n-desc-en="A categorized directory of frequently used AI websites and tools.">
  </body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/ai/",
  });
  await loadI18n(dom);
  const { document } = dom.window;

  dom.window.cwlSetLang("en");
  assert.equal(document.title, "AI Navigation :: CWLBlog", "should use inline title-en");
  const desc = document.querySelector('meta[name="description"]').getAttribute("content");
  assert.ok(desc.includes("categorized directory"), "should use inline desc-en");
  dom.window.close();
});

// ─── cwlSetLang with invalid value ────────────────────────────────────────

test("i18n.js cwlSetLang defaults to zh for unknown values", async () => {
  const dom = new JSDOM(`<!doctype html><html lang="zh-CN"><head></head><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadI18n(dom);

  dom.window.cwlSetLang("fr");
  assert.equal(dom.window.cwlLang(), "zh", "should default to zh for unknown language");
  dom.window.close();
});
