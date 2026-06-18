// Deep test: coder.js — 进度条、返回顶部、代码复制、TOC、阅读时间、showPost、滚动揭示
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

function buildDom(html, opts = {}) {
  return new JSDOM(html, {
    runScripts: "outside-only",
    url: opts.url || "https://wenliang844.github.io/post/test/",
    pretendToBeVisual: true,
  });
}

async function loadCoder(dom) {
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const i18nCode = await readFile(join(ROOT, "js", "i18n.js"), "utf8");
  const coderCode = await readFile(join(ROOT, "js", "coder.js"), "utf8");
  dom.window.eval(utilsCode);
  dom.window.eval(i18nCode);
  dom.window.eval(coderCode);
  return dom;
}

// ─── 阅读进度条创建 ─────────────────────────────────────────────────────────

test("coder.js creates reading progress bar", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <article class="article"><div class="article-content"><p>Content</p></div></article>
  </body></html>`);
  await loadCoder(dom);
  const bar = dom.window.document.querySelector(".read-progress");
  assert.ok(bar, "should create read-progress element");
  dom.window.close();
});

// ─── 返回顶部按钮创建 ───────────────────────────────────────────────────────

test("coder.js creates back-to-top button", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <article class="article"><div class="article-content"><p>Content</p></div></article>
  </body></html>`);
  await loadCoder(dom);
  const btn = dom.window.document.querySelector(".to-top");
  assert.ok(btn, "should create to-top button");
  assert.equal(btn.tagName, "BUTTON");
  assert.equal(btn.type, "button");
  dom.window.close();
});

// ─── 返回顶部不重复创建 ─────────────────────────────────────────────────────

test("coder.js does not duplicate existing to-top button", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <button class="to-top" type="button">Top</button>
    <article class="article"><div class="article-content"><p>Content</p></div></article>
  </body></html>`);
  await loadCoder(dom);
  const btns = dom.window.document.querySelectorAll(".to-top");
  assert.equal(btns.length, 1, "should not create duplicate to-top button");
  dom.window.close();
});

// ─── 代码块复制按钮 ─────────────────────────────────────────────────────────

test("coder.js adds copy button to code blocks", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <article class="article"><div class="article-content">
      <pre><code>console.log("hello");</code></pre>
    </div></article>
  </body></html>`);
  await loadCoder(dom);
  const btn = dom.window.document.querySelector(".code-copy");
  assert.ok(btn, "should add copy button to pre block");
  assert.equal(btn.type, "button");
  dom.window.close();
});

// ─── 代码块不重复添加复制按钮 ───────────────────────────────────────────────

test("coder.js does not add duplicate copy buttons", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <article class="article"><div class="article-content">
      <pre><code class="code-copy">has button</code></pre>
    </div></article>
  </body></html>`);
  await loadCoder(dom);
  // The code-copy class on <code> means the pre already has a copy button
  const btns = dom.window.document.querySelectorAll("pre .code-copy");
  assert.equal(btns.length, 1, "should not duplicate copy button");
  dom.window.close();
});

// ─── TOC 构建（>= 3 个标题时） ──────────────────────────────────────────────

test("coder.js builds TOC for articles with 3+ headings", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <article class="article">
      <div class="article-content">
        <h2>Section One</h2><p>Content for section one with enough text to work.</p>
        <h2>Section Two</h2><p>Content for section two with enough text to work.</p>
        <h2>Section Three</h2><p>Content for section three with enough text.</p>
      </div>
    </article>
  </body></html>`);
  await loadCoder(dom);
  const toc = dom.window.document.querySelector(".article-toc");
  assert.ok(toc, "should create TOC for 3+ headings");
  const links = toc.querySelectorAll("a");
  assert.equal(links.length, 3, "TOC should have 3 links");
  dom.window.close();
});

// ─── TOC 不构建（< 3 个标题时） ─────────────────────────────────────────────

test("coder.js does not build TOC for articles with fewer than 3 headings", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <article class="article">
      <div class="article-content">
        <h2>Section One</h2><p>Content for section one.</p>
        <h2>Section Two</h2><p>Content for section two.</p>
      </div>
    </article>
  </body></html>`);
  await loadCoder(dom);
  const toc = dom.window.document.querySelector(".article-toc");
  assert.ok(!toc, "should not create TOC for fewer than 3 headings");
  dom.window.close();
});

// ─── TOC 折叠/展开 ─────────────────────────────────────────────────────────

test("coder.js TOC toggle collapses and expands", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <article class="article">
      <div class="article-content">
        <h2>First</h2><p>Content one with enough text.</p>
        <h2>Second</h2><p>Content two with enough text.</p>
        <h2>Third</h2><p>Content three with enough text.</p>
      </div>
    </article>
  </body></html>`);
  await loadCoder(dom);
  const { document } = dom.window;
  const toc = document.querySelector(".article-toc");
  assert.ok(toc, "should have TOC");
  assert.ok(toc.classList.contains("is-open"), "should start open");

  const toggle = toc.querySelector(".article-toc-toggle");
  assert.ok(toggle, "should have toggle button");
  assert.equal(toggle.getAttribute("aria-expanded"), "true");

  toggle.click();
  assert.ok(toc.classList.contains("is-collapsed"), "should collapse after click");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");

  toggle.click();
  assert.ok(toc.classList.contains("is-open"), "should expand after second click");
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  dom.window.close();
});

// ─── 阅读时间 span 渲染 ─────────────────────────────────────────────────────

test("coder.js renders reading-time span in article meta", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <article class="article">
      <div class="article-meta"></div>
      <div class="article-content">
        <p>${"这是一段足够长的中文测试文本内容。".repeat(50)}</p>
      </div>
    </article>
  </body></html>`);
  await loadCoder(dom);
  const span = dom.window.document.querySelector(".reading-time");
  assert.ok(span, "should create reading-time span");
  assert.ok(span.textContent.includes("分钟") || span.textContent.includes("min"), "should show time unit");
  dom.window.close();
});

// ─── showPost 函数面板切换 ───────────────────────────────────────────────────

test("coder.js showPost toggles active article panel", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <a class="post-tree-link" data-post-target="post-a">A</a>
    <a class="post-tree-link active" data-post-target="post-b">B</a>
    <article class="blog-article active" id="post-b" data-post-slug="b">
      <div class="article-content"><p>Post B</p></div>
    </article>
    <article class="blog-article" id="post-a" data-post-slug="a">
      <div class="article-content"><p>Post A</p></div>
    </article>
  </body></html>`);
  await loadCoder(dom);
  const { document } = dom.window;

  // Initially post-b is active
  assert.ok(document.getElementById("post-b").classList.contains("active"));
  assert.ok(!document.getElementById("post-a").classList.contains("active"));

  // Switch to post-a
  dom.window.coderShowPost("post-a", false);

  assert.ok(document.getElementById("post-a").classList.contains("active"));
  assert.ok(!document.getElementById("post-b").classList.contains("active"));
  dom.window.close();
});

// ─── showPost 设置 aria-current ─────────────────────────────────────────────

test("coder.js showPost sets aria-current on active link", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <a class="post-tree-link" data-post-target="post-a">A</a>
    <a class="post-tree-link active" data-post-target="post-b">B</a>
    <article class="blog-article active" id="post-b" data-post-slug="b">
      <div class="article-content"><p>Post B</p></div>
    </article>
    <article class="blog-article" id="post-a" data-post-slug="a">
      <div class="article-content"><p>Post A</p></div>
    </article>
  </body></html>`);
  await loadCoder(dom);
  const { document } = dom.window;

  dom.window.coderShowPost("post-a", false);
  const linkA = document.querySelector('[data-post-target="post-a"]');
  const linkB = document.querySelector('[data-post-target="post-b"]');
  assert.equal(linkA.getAttribute("aria-current"), "page");
  assert.equal(linkB.getAttribute("aria-current"), null);
  dom.window.close();
});

// ─── 主题切换持久化 ─────────────────────────────────────────────────────────

test("coder.js theme toggle persists to localStorage", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <button class="theme-toggle" type="button"></button>
  </body></html>`);
  await loadCoder(dom);
  const { document, localStorage } = dom.window;

  document.querySelector(".theme-toggle").click();
  assert.equal(localStorage.getItem("coder-color-scheme"), "light");

  document.querySelector(".theme-toggle").click();
  assert.equal(localStorage.getItem("coder-color-scheme"), "dark");
  dom.window.close();
});

// ─── 默认暗色主题（无 localStorage 记录） ────────────────────────────────────

test("coder.js defaults to dark theme when no preference stored", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <button class="theme-toggle" type="button"></button>
  </body></html>`);
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const coderCode = await readFile(join(ROOT, "js", "coder.js"), "utf8");
  dom.window.eval(utilsCode);
  dom.window.eval(coderCode);
  assert.ok(dom.window.document.body.classList.contains("colorscheme-dark"), "should default to dark");
  dom.window.close();
});

// ─── localStorage 存 light 时初始为亮色 ──────────────────────────────────────

test("coder.js starts light when localStorage has 'light'", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <button class="theme-toggle" type="button"></button>
  </body></html>`);
  dom.window.localStorage.setItem("coder-color-scheme", "light");
  await loadCoder(dom);
  assert.ok(dom.window.document.body.classList.contains("colorscheme-light"), "should start light");
  assert.ok(!dom.window.document.body.classList.contains("colorscheme-dark"), "dark should be removed");
  dom.window.close();
});

// ─── 语言切换更新 TOC 文本 ──────────────────────────────────────────────────

test("coder.js updates TOC label on language change", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark" data-i18n-page="posts">
    <title>Test</title>
    <article class="article">
      <div class="article-content">
        <h2>Section A</h2><p>Content for section A with enough text.</p>
        <h2>Section B</h2><p>Content for section B with enough text.</p>
        <h2>Section C</h2><p>Content for section C with enough text.</p>
      </div>
    </article>
  </body></html>`);
  await loadCoder(dom);
  const { document } = dom.window;

  const toggle = document.querySelector(".article-toc-toggle");
  assert.ok(toggle, "should have TOC toggle");
  // 默认中文应包含"目录"
  const label = toggle.textContent;
  assert.ok(label.length > 0, "TOC toggle should have text");

  // 切换语言
  dom.window.cwlSetLang("en");
  const enLabel = toggle.querySelector("span").textContent;
  assert.equal(enLabel, "Contents", "should show English label after language switch");

  dom.window.close();
});

// ─── 多个代码块各自获得独立复制按钮 ─────────────────────────────────────────

test("coder.js adds independent copy button to each code block", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <article class="article"><div class="article-content">
      <pre><code>code block 1</code></pre>
      <pre><code>code block 2</code></pre>
      <pre><code>code block 3</code></pre>
    </div></article>
  </body></html>`);
  await loadCoder(dom);
  const btns = dom.window.document.querySelectorAll(".code-copy");
  assert.equal(btns.length, 3, "should add copy button to each pre block");
  dom.window.close();
});

// ─── h3 标题也纳入 TOC ──────────────────────────────────────────────────────

test("coder.js includes h3 headings in TOC", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <article class="article">
      <div class="article-content">
        <h2>Section One</h2><p>Content for section one text.</p>
        <h3>Sub A</h3><p>Sub content A text here.</p>
        <h2>Section Two</h2><p>Content for section two text.</p>
      </div>
    </article>
  </body></html>`);
  await loadCoder(dom);
  const toc = dom.window.document.querySelector(".article-toc");
  assert.ok(toc, "should build TOC with 3+ headings");
  const links = toc.querySelectorAll("a");
  assert.equal(links.length, 3, "should have 3 entries including h3");

  const depthItems = toc.querySelectorAll(".toc-depth-3");
  assert.ok(depthItems.length >= 1, "should have depth-3 items for h3");
  dom.window.close();
});

// ─── 多文章面板只有目标激活 ──────────────────────────────────────────────────

test("coder.js showPost only activates one panel at a time", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <a class="post-tree-link" data-post-target="p1">P1</a>
    <a class="post-tree-link" data-post-target="p2">P2</a>
    <a class="post-tree-link" data-post-target="p3">P3</a>
    <article class="blog-article" id="p1" data-post-slug="p1"><div class="article-content"><p>1</p></div></article>
    <article class="blog-article" id="p2" data-post-slug="p2"><div class="article-content"><p>2</p></div></article>
    <article class="blog-article" id="p3" data-post-slug="p3"><div class="article-content"><p>3</p></div></article>
  </body></html>`);
  await loadCoder(dom);
  const { document } = dom.window;

  dom.window.coderShowPost("p2", false);
  const activePanels = document.querySelectorAll(".blog-article.active");
  assert.equal(activePanels.length, 1, "should have exactly 1 active panel");
  assert.equal(activePanels[0].id, "p2");
  dom.window.close();
});

// ─── 粒子动画空闲停止 ───────────────────────────────────────────────────────

test("coder.js cursor particles only animate while particles are active", async () => {
  const dom = buildDom(`<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
    <canvas class="cursor-canvas"></canvas>
  </body></html>`);
  const rafQueue = [];
  const context = {
    setTransform: () => {},
    clearRect: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    set fillStyle(_value) {},
    set shadowColor(_value) {},
    set shadowBlur(_value) {},
  };
  dom.window.HTMLCanvasElement.prototype.getContext = () => context;
  dom.window.requestAnimationFrame = (callback) => {
    rafQueue.push(callback);
    return rafQueue.length;
  };
  dom.window.cancelAnimationFrame = () => {};

  await loadCoder(dom);

  assert.equal(rafQueue.length, 0, "idle cursor canvas should not start an animation loop");

  dom.window.dispatchEvent(new dom.window.MouseEvent("pointermove", {
    clientX: 24,
    clientY: 36,
    bubbles: true,
  }));

  assert.equal(rafQueue.length, 1, "pointer movement should start the particle loop");

  for (let i = 0; i < 80 && rafQueue.length; i += 1) {
    const callback = rafQueue.shift();
    callback();
  }

  assert.equal(rafQueue.length, 0, "particle loop should stop after particles decay");
  dom.window.close();
});
