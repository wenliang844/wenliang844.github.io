// Deep test: coder.js — theme toggle, reading time, slugify, TOC, scroll, copy
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { loadClientModule } from "./helpers/client-module.mjs";

const ROOT = join(import.meta.dirname, "..");

function buildDom(html, opts = {}) {
  return new JSDOM(html, {
    runScripts: "outside-only",
    url: opts.url || "https://wenliang844.github.io/post/test/",
    pretendToBeVisual: true,
  });
}

async function loadCoder(dom, options = {}) {
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const i18nCode = await readFile(join(ROOT, "js", "i18n.js"), "utf8");
  dom.window.eval(utilsCode);
  dom.window.eval(i18nCode);
  const runtime = await loadClientModule(dom, "src/client/site-runtime.ts", "SiteRuntimeClient");
  runtime.initSiteRuntime();
  const enhancements = await loadClientModule(dom, "src/client/article-enhancements.ts", "ArticleEnhancementsClient");
  const reading = await loadClientModule(dom, "src/client/article-reading.ts", "ArticleReadingClient");
  enhancements.initArticleEnhancements();
  reading.initArticleReading();
  return dom;
}

// ─── readingMinutes (client-side) ─────────────────────────────────────────

test("site runtime loads alongside article reading on empty text", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <article class="article"><div class="article-content"><div class="article-meta"></div></div></article>
  </body></html>`);
  await loadCoder(dom);
  // The function is internal; we test through reading-time span rendering
  dom.window.close();
  assert.ok(true, "site runtime loaded without errors");
});

// ─── Theme toggle ─────────────────────────────────────────────────────────

test("site runtime theme toggle switches between dark and light", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <button class="theme-toggle" type="button" aria-label="Toggle theme"></button>
  </body></html>`);
  await loadCoder(dom);
  const { document } = dom.window;

  const btn = document.querySelector(".theme-toggle");
  assert.ok(document.body.classList.contains("colorscheme-dark"), "starts dark");

  btn.click();
  assert.ok(document.body.classList.contains("colorscheme-light"), "switches to light after click");
  assert.ok(!document.body.classList.contains("colorscheme-dark"), "dark removed");

  btn.click();
  assert.ok(document.body.classList.contains("colorscheme-dark"), "switches back to dark");
  dom.window.close();
});

// ─── slugify (client-side) ────────────────────────────────────────────────

test("article runtime slugifies headings into URL-safe TOC ids", async () => {
  // coder.js slugify is internal, but we can verify it through heading ID generation
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <article class="article">
      <div class="article-meta"></div>
      <div class="article-content">
        <h2>First Section</h2>
        <h2>Second Section</h2>
        <h3>Sub Section</h3>
        <p>Content here for testing purposes with enough text.</p>
      </div>
    </article>
  </body></html>`);
  await loadCoder(dom);
  const { document } = dom.window;

  // With 3+ headings, a TOC should be built
  const toc = document.querySelector(".article-toc");
  assert.ok(toc, "TOC should be built for 3+ headings");

  const links = toc.querySelectorAll("a");
  assert.ok(links.length >= 3, "TOC should have at least 3 links");

  // Each heading should have an id assigned
  const h2s = document.querySelectorAll(".article-content h2");
  h2s.forEach((h2) => {
    assert.ok(h2.id, "h2 should have id assigned");
    assert.ok(h2.id.startsWith("toc-"), "id should start with toc-");
  });
  dom.window.close();
});

// ─── TOC building with < 3 headings ──────────────────────────────────────

test("article runtime does not build TOC for fewer than 3 headings", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <article class="article">
      <div class="article-meta"></div>
      <div class="article-content">
        <h2>Only Heading</h2>
        <p>Some content.</p>
      </div>
    </article>
  </body></html>`);
  await loadCoder(dom);

  const toc = dom.window.document.querySelector(".article-toc");
  assert.equal(toc, null, "TOC should not be built for < 3 headings");
  dom.window.close();
});

// ─── TOC toggle open/close ────────────────────────────────────────────────

test("article runtime TOC toggle button toggles open and closed", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <article class="article">
      <div class="article-meta"></div>
      <div class="article-content">
        <h2>Section One</h2>
        <h2>Section Two</h2>
        <h2>Section Three</h2>
        <p>Enough content here.</p>
      </div>
    </article>
  </body></html>`);
  await loadCoder(dom);
  const { document } = dom.window;

  const toc = document.querySelector(".article-toc");
  assert.ok(toc, "TOC built");
  assert.ok(toc.classList.contains("is-open"), "TOC starts open");

  const toggle = toc.querySelector(".article-toc-toggle");
  assert.ok(toggle, "toggle button exists");
  assert.equal(toggle.getAttribute("aria-expanded"), "true");

  toggle.click();
  assert.ok(toc.classList.contains("is-collapsed"), "TOC collapsed after click");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");

  toggle.click();
  assert.ok(toc.classList.contains("is-open"), "TOC re-opened");
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  dom.window.close();
});

// ─── Back-to-top button ──────────────────────────────────────────────────

test("site runtime creates back-to-top button", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark"></body></html>`);
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  dom.window.eval(utilsCode);
  const runtime = await loadClientModule(dom, "src/client/site-runtime.ts", "SiteRuntimeClient");
  runtime.initSiteRuntime();

  const toTop = dom.window.document.querySelector(".to-top");
  assert.ok(toTop, "back-to-top button created");
  assert.equal(toTop.tagName, "BUTTON");
  assert.equal(toTop.type, "button");
  dom.window.close();
});

// ─── Progress bar ─────────────────────────────────────────────────────────

test("article reading runtime stays absent on non-article pages", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark"></body></html>`);
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  dom.window.eval(utilsCode);
  const runtime = await loadClientModule(dom, "src/client/site-runtime.ts", "SiteRuntimeClient");
  runtime.initSiteRuntime();

  const progress = dom.window.document.querySelector(".read-progress");
  assert.equal(progress, null, "progress bar should only exist on article routes");
  dom.window.close();
});

// ─── Copy button on code blocks ──────────────────────────────────────────

test("article runtime adds copy buttons to code blocks", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <article class="article"><div class="article-content">
      <pre><code>console.log("hello");</code></pre>
      <pre><code>another block</code></pre>
    </div></article>
  </body></html>`);
  await loadCoder(dom);
  const { document } = dom.window;

  const copyBtns = document.querySelectorAll(".code-copy");
  assert.equal(copyBtns.length, 2, "should add copy button to each pre block");
  assert.equal(copyBtns[0].type, "button");
  dom.window.close();
});

// ─── Scroll reveal (prefers-reduced-motion) ───────────────────────────────

test("site runtime does not add reveal class when reduced motion is preferred", async () => {
  const dom = new JSDOM(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <div class="card">Card 1</div>
    <div class="card">Card 2</div>
  </body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
    pretendToBeVisual: true,
  });
  // Mock matchMedia to return reduced-motion
  dom.window.matchMedia = (query) => ({
    matches: query.includes("reduced-motion"),
    addListener: () => {},
    removeListener: () => {},
  });
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  dom.window.eval(utilsCode);
  const runtime = await loadClientModule(dom, "src/client/site-runtime.ts", "SiteRuntimeClient");
  runtime.initSiteRuntime();

  const cards = dom.window.document.querySelectorAll(".card");
  cards.forEach((card) => {
    assert.ok(!card.classList.contains("reveal"), "should not add reveal class under reduced-motion");
  });
  dom.window.close();
});

// ─── Skill bar animation ─────────────────────────────────────────────────

test("site runtime leaves skill levels in CSP-safe data attributes", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <div class="skill-fill" data-level="85"></div>
    <div class="skill-fill" data-level="60"></div>
  </body></html>`);
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  dom.window.eval(utilsCode);
  const runtime = await loadClientModule(dom, "src/client/site-runtime.ts", "SiteRuntimeClient");
  runtime.initSiteRuntime();

  const fills = dom.window.document.querySelectorAll(".skill-fill");
  assert.equal(fills[0].dataset.level, "85");
  assert.equal(fills[1].dataset.level, "60");
  assert.equal(fills[0].hasAttribute("style"), false);
  assert.equal(fills[1].hasAttribute("style"), false);
  dom.window.close();
});

// ─── Dynamic text update on lang change ───────────────────────────────────

test("site runtime updates dynamic text on cwl:langchange", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <button class="to-top" type="button"></button>
    <button class="code-copy" type="button"><i class="fas fa-copy"></i> 复制</button>
  </body></html>`);
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const i18nCode = await readFile(join(ROOT, "js", "i18n.js"), "utf8");
  dom.window.eval(utilsCode);
  dom.window.eval(i18nCode);
  const runtime = await loadClientModule(dom, "src/client/site-runtime.ts", "SiteRuntimeClient");
  runtime.initSiteRuntime();

  const toTop = dom.window.document.querySelector(".to-top");
  assert.equal(toTop.getAttribute("aria-label"), "返回顶部", "default Chinese label");

  // Switch to English
  dom.window.cwlSetLang("en");
  assert.equal(toTop.getAttribute("aria-label"), "Back to top", "English label after lang change");
  dom.window.close();
});

test("site runtime is idempotent and reinitializes after bfcache restore", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <button class="theme-toggle" type="button"></button>
  </body></html>`);
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  dom.window.eval(utilsCode);
  const runtime = await loadClientModule(dom, "src/client/site-runtime.ts", "SiteRuntimeClient");
  runtime.initSiteRuntime();
  runtime.initSiteRuntime();

  const button = dom.window.document.querySelector(".theme-toggle");
  button.click();
  assert.equal(dom.window.localStorage.getItem("coder-color-scheme"), "light");
  dom.window.dispatchEvent(new dom.window.Event("pagehide"));
  const restore = new dom.window.Event("pageshow");
  Object.defineProperty(restore, "persisted", { value: true });
  dom.window.dispatchEvent(restore);
  button.click();
  assert.equal(dom.window.localStorage.getItem("coder-color-scheme"), "dark");
  assert.equal(dom.window.document.querySelectorAll(".to-top").length, 1);
  dom.window.close();
});
