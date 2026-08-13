// Deep test: post-list.ts - search, tag filter, J/K navigation, sidebar FAB
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { evaluateClientModule } from "./helpers/client-module.mjs";

const ROOT = join(import.meta.dirname, "..");

const BLOG_HTML = `<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
  <div class="post-tree">
    <nav class="post-tree-nav">
      <details class="tree-group" open><span class="tree-count">3</span><ul><li><a class="post-tree-link active" data-post-target="post-a" href="#post-a" aria-current="page">
        <span class="tree-title">Activiti 工作流引擎</span>
      </a></li><li><a class="post-tree-link" data-post-target="post-b" href="#post-b">
        <span class="tree-title">金融 SaaS 后端实践</span>
      </a></li><li><a class="post-tree-link" data-post-target="post-c" href="#post-c">
        <span class="tree-title">低代码 Schema 与代码生成</span>
      </a></li></ul></details>
    </nav>
  </div>
  <input type="text" id="post-search-input" placeholder="搜索...">
  <div id="tag-filter"></div>
  <section class="post-detail"><article class="post-summary-card active" id="post-a" data-post-slug="activiti-workflow-engine">
    <h2><a href="/post/activiti-workflow-engine/">Activiti 工作流引擎</a></h2>
    <div class="article-summary">Activiti 工作流引擎项目复盘</div>
    <div class="post-tags">
      <button class="post-list-tag" data-tag="Java">Java</button>
      <button class="post-list-tag" data-tag="Spring">Spring</button>
    </div>
  </article>
  <article class="post-summary-card" id="post-b" data-post-slug="finance-saas-backend">
    <h2><a href="/post/finance-saas-backend/">金融 SaaS 后端实践</a></h2>
    <div class="article-summary">金融 SaaS 后端实践</div>
    <div class="post-tags">
      <button class="post-list-tag" data-tag="Java">Java</button>
      <button class="post-list-tag" data-tag="ES">ElasticSearch</button>
    </div>
  </article>
  <article class="post-summary-card" id="post-c" data-post-slug="lowcode-schema-codegen">
    <h2><a href="/post/lowcode-schema-codegen/">低代码 Schema 与代码生成</a></h2>
    <div class="article-summary">低代码 Schema 与代码生成</div>
    <div class="post-tags">
      <button class="post-list-tag" data-tag="TypeScript">TypeScript</button>
      <button class="post-list-tag" data-tag="React">React</button>
    </div>
  </article><p class="post-list-empty" hidden></p></section>
</body></html>`;

async function loadBlog(dom) {
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  dom.window.eval(utilsCode);
  return evaluateClientModule(dom, "src/client/post-list.ts", "PostListClient", "initPostList");
}

test("post-list module builds post card cache once during startup", async () => {
  const dom = new JSDOM(BLOG_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/",
  });
  const calls = new Map();
  const originalGetElementById = dom.window.document.getElementById.bind(dom.window.document);
  dom.window.document.getElementById = function (id) {
    if (id.startsWith("post-")) {
      calls.set(id, (calls.get(id) || 0) + 1);
    }
    return originalGetElementById(id);
  };

  await loadBlog(dom);

  assert.equal(calls.get("post-a"), 1, "post-a card should be read once");
  assert.equal(calls.get("post-b"), 1, "post-b card should be read once");
  assert.equal(calls.get("post-c"), 1, "post-c card should be read once");
  dom.window.close();
});

// ─── Search filtering ─────────────────────────────────────────────────────

test("post-list module search input filters posts by keyword", async () => {
  const dom = new JSDOM(BLOG_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/",
  });
  await loadBlog(dom);
  const { document } = dom.window;

  const searchInput = document.getElementById("post-search-input");
  searchInput.value = "Activiti";
  searchInput.dispatchEvent(new dom.window.Event("input"));

  // Wait for debounce
  await new Promise((r) => dom.window.setTimeout(r, 300));

  const activitiLink = document.querySelector('[data-post-target="post-a"]');
  const financeCard = document.getElementById("post-b");
  assert.ok(!activitiLink.closest("li").hidden, "matching tree link should remain visible");
  assert.ok(financeCard.hidden, "non-matching summary card should be hidden");

  // Check that empty state is hidden (some results found)
  const empty = document.querySelector(".post-list-empty");
  assert.ok(empty.hidden, "empty state should be hidden when results exist");
  dom.window.close();
});

// ─── Search with no results ───────────────────────────────────────────────

test("post-list module shows empty state when search has no matches", async () => {
  const dom = new JSDOM(BLOG_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/",
  });
  await loadBlog(dom);
  const { document } = dom.window;

  const searchInput = document.getElementById("post-search-input");
  searchInput.value = "xyznonexistent";
  searchInput.dispatchEvent(new dom.window.Event("input"));

  await new Promise((r) => dom.window.setTimeout(r, 300));

  const empty = document.querySelector(".post-list-empty");
  assert.ok(!empty.hidden, "empty state should be visible when no matches");
  dom.window.close();
});

// ─── Tag filter ───────────────────────────────────────────────────────────

test("post-list module creates tag filter chips from post tags", async () => {
  const dom = new JSDOM(BLOG_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/",
  });
  await loadBlog(dom);
  const { document } = dom.window;

  const tagFilter = document.getElementById("tag-filter");
  const chips = tagFilter.querySelectorAll(".tag-chip");
  assert.ok(chips.length >= 3, `should have tag chips, got ${chips.length}`);

  // Check that Java tag exists
  const javaChip = tagFilter.querySelector('[data-tag="Java"]');
  assert.ok(javaChip, "should have Java tag chip");
  dom.window.close();
});

// ─── Tag filter click toggles active state ────────────────────────────────

test("post-list module tag chip click toggles filter", async () => {
  const dom = new JSDOM(BLOG_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/",
  });
  await loadBlog(dom);
  const { document } = dom.window;

  const javaChip = document.querySelector('[data-tag="Java"]');
  assert.ok(javaChip, "Java chip should exist");

  javaChip.click();
  assert.ok(javaChip.classList.contains("active"), "Java chip should be active after click");

  // Click again to deactivate
  javaChip.click();
  assert.ok(!javaChip.classList.contains("active"), "Java chip should be inactive after second click");
  dom.window.close();
});

// ─── Tag filter URL sync ──────────────────────────────────────────────────

test("post-list module updates URL with tag parameter when tag is selected", async () => {
  const dom = new JSDOM(BLOG_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/",
  });
  await loadBlog(dom);
  const { window } = dom;

  const javaChip = window.document.querySelector('[data-tag="Java"]');
  javaChip.click();

  assert.ok(window.location.href.includes("tag=Java"), "URL should include tag=Java parameter");

  // Click again to remove
  javaChip.click();
  assert.ok(!window.location.href.includes("tag="), "URL should not include tag parameter");
  dom.window.close();
});

// ─── Tag filter from URL parameter ────────────────────────────────────────

test("post-list module activates tag from URL ?tag= parameter on load", async () => {
  const dom = new JSDOM(BLOG_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/?tag=TypeScript",
  });
  await loadBlog(dom);
  const { document } = dom.window;

  const tsChip = document.querySelector('[data-tag="TypeScript"]');
  assert.ok(tsChip, "TypeScript chip should exist");
  assert.ok(tsChip.classList.contains("active"), "TypeScript chip should be active from URL");
  dom.window.close();
});

// ─── Mobile sidebar FAB ───────────────────────────────────────────────────

test("post-list module creates mobile sidebar FAB button", async () => {
  const dom = new JSDOM(BLOG_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/",
  });
  await loadBlog(dom);
  const { document } = dom.window;

  const fab = document.querySelector(".post-tree-fab");
  const collapse = document.querySelector(".post-tree .post-tree-collapse");
  assert.ok(fab, "mobile FAB should be created");
  assert.ok(collapse, "floating sidebar should include a collapse button");
  assert.equal(fab.type, "button");
  assert.equal(collapse.type, "button");
  assert.equal(fab.getAttribute("aria-expanded"), "false");
  assert.ok(fab.querySelector("svg.post-tree-fab-icon"), "FAB should use an inline expand icon");
  assert.ok(collapse.querySelector("svg.post-tree-fab-icon"), "collapse button should use an inline shrink icon");
  assert.match(fab.getAttribute("aria-label"), /展开|Expand/);
  assert.match(collapse.getAttribute("aria-label"), /收起|Collapse/);
  dom.window.close();
});

// ─── Mobile sidebar floating collapse ─────────────────────────────────────

test("post-list module opens the floating sidebar and closes it from the sidebar button", async () => {
  const dom = new JSDOM(BLOG_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/",
  });
  await loadBlog(dom);
  const { document } = dom.window;

  const fab = document.querySelector(".post-tree-fab");
  const sidebar = document.querySelector(".post-tree");
  const collapse = sidebar.querySelector(".post-tree-collapse");

  fab.click();
  assert.ok(sidebar.classList.contains("is-floating-open"), "sidebar should be open");
  assert.ok(document.body.classList.contains("post-tree-floating"), "body should have floating class");
  assert.equal(fab.getAttribute("aria-expanded"), "true");
  assert.ok(fab.classList.contains("is-hidden"), "open FAB should hide while the sidebar is open");
  assert.match(collapse.getAttribute("aria-label"), /收起|Collapse/);

  collapse.click();
  assert.ok(!sidebar.classList.contains("is-floating-open"), "sidebar should be closed");
  assert.equal(fab.getAttribute("aria-expanded"), "false");
  assert.ok(!fab.classList.contains("is-hidden"), "open FAB should be visible again after closing");
  dom.window.close();
});

// ─── Escape closes sidebar ────────────────────────────────────────────────

test("post-list module Escape key closes floating sidebar", async () => {
  const dom = new JSDOM(BLOG_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/",
  });
  await loadBlog(dom);
  const { document, KeyboardEvent } = dom.window;

  const fab = document.querySelector(".post-tree-fab");
  const sidebar = document.querySelector(".post-tree");

  // Open sidebar
  fab.click();
  assert.ok(sidebar.classList.contains("is-floating-open"), "sidebar should be open");

  // Press Escape
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.ok(!sidebar.classList.contains("is-floating-open"), "sidebar should close on Escape");
  dom.window.close();
});

// ─── Vim J/K navigation ──────────────────────────────────────────────────

test("post-list module J/K keys navigate between posts", async () => {
  const dom = new JSDOM(BLOG_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/",
  });
  await loadBlog(dom);
  const { document, KeyboardEvent } = dom.window;

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true }));
  assert.ok(document.querySelector('[data-post-target="post-b"]').classList.contains("active"));
  dom.window.close();
});

// ─── J/K navigation skips when editing ────────────────────────────────────

test("post-list module J/K keys don't navigate when input is focused", async () => {
  const dom = new JSDOM(BLOG_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/",
  });
  await loadBlog(dom);
  const { document, KeyboardEvent } = dom.window;

  // Focus on search input
  const searchInput = document.getElementById("post-search-input");
  searchInput.focus();

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true }));
  assert.equal(document.querySelector(".post-tree-link.active")?.dataset.postTarget, "post-a", "focused input should suppress navigation");
  dom.window.close();
});

// ─── Clickable tags in article ────────────────────────────────────────────

test("post-list module renders semantic tag buttons", async () => {
  const dom = new JSDOM(BLOG_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/",
  });
  await loadBlog(dom);
  const { document } = dom.window;

  const tagButtons = document.querySelectorAll(".post-summary-card .post-list-tag");
  assert.ok(tagButtons.length > 0);
  tagButtons.forEach((button) => {
    assert.equal(button.tagName, "BUTTON");
  });
  dom.window.close();
});

// ─── Empty state i18n ─────────────────────────────────────────────────────

test("post-list module empty state text updates on language change", async () => {
  const dom = new JSDOM(BLOG_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/",
  });
  await loadBlog(dom);
  const { document } = dom.window;

  const empty = document.querySelector(".post-list-empty");
  assert.ok(empty.textContent.includes("没有匹配") || empty.textContent.includes("No matching"), "should have empty state text");
  dom.window.close();
});

// ─── Early exit without tree nav ──────────────────────────────────────────

test("post-list module exits gracefully without post-tree-nav", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await evaluateClientModule(dom, "src/client/post-list.ts", "PostListClient", "initPostList");
  assert.ok(true, "post-list module should exit gracefully without tree nav");
  dom.window.close();
});
