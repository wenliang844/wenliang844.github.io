import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { loadClientModule } from "./helpers/client-module.mjs";

function buildDom(body, url = "https://wenliang844.github.io/post/test/") {
  const dom = new JSDOM(`<!doctype html><html><body>${body}</body></html>`, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url,
  });
  dom.window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  return dom;
}

test("article reading limits storage writes and flushes on pagehide", async () => {
  const dom = buildDom('<article class="article" data-post-slug="test"><div class="article-content">Body</div></article>');
  const writes = [];
  dom.window.CWLUtils = {
    storageGet: () => null,
    storageSet: (key, value) => writes.push([key, JSON.parse(value)]),
    throttle: (callback) => callback,
    t: (_key, fallback) => fallback,
  };
  const article = dom.window.document.querySelector("article");
  Object.defineProperty(article, "scrollHeight", { value: 2000 });
  article.getBoundingClientRect = () => ({ top: -400 });
  const module = await loadClientModule(dom, "src/client/article-reading.ts", "ArticleReadingClient");
  module.initArticleReading();

  dom.window.dispatchEvent(new dom.window.Event("scroll"));
  dom.window.dispatchEvent(new dom.window.Event("scroll"));
  assert.equal(writes.length, 1, "unchanged progress should not rewrite localStorage");
  assert.equal(writes[0][0], "cwl.reading.test");
  dom.window.dispatchEvent(new dom.window.Event("pagehide"));
  assert.equal(writes.length, 2, "pagehide should flush current progress");
  dom.window.close();
});

test("article enhancements handle copy failure and restore lightbox focus", async () => {
  const dom = buildDom(`<article class="article"><div class="article-content">
    <pre><code>const value = 1;</code></pre><img src="/image.png" alt="Architecture">
  </div></article>`);
  dom.window.CWLUtils = {
    copyText: async () => { throw new Error("denied"); },
    readingMinutes: () => 1,
    t: (_key, fallback) => fallback,
  };
  const module = await loadClientModule(dom, "src/client/article-enhancements.ts", "ArticleEnhancementsClient");
  module.initArticleEnhancements();

  const copy = dom.window.document.querySelector(".code-copy");
  copy.click();
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  assert.match(copy.textContent, /复制失败/);
  const image = dom.window.document.querySelector("img");
  image.focus();
  image.click();
  dom.window.document.querySelector(".lightbox-close").click();
  assert.equal(dom.window.document.activeElement, image);
  dom.window.close();
});

test("article route components initialize the runtime", async () => {
  const { readFile } = await import("node:fs/promises");
  const article = await readFile(new URL("../src/components/ArticlePage.astro", import.meta.url), "utf8");
  const list = await readFile(new URL("../src/components/PostListPage.astro", import.meta.url), "utf8");
  assert.match(article, /initArticleRuntime\(\)/);
  assert.match(list, /initArticleRuntime\(\)/);
});

test("dynamic article TOC highlights the current heading on scroll", async () => {
  const dom = buildDom(`<article class="article"><div class="article-content">
    <h2>First</h2><h2>Second</h2><h3>Third</h3>
  </div></article>`);
  dom.window.CWLUtils = {
    readingMinutes: () => 1,
    t: (_key, fallback) => fallback,
    throttle: (callback) => callback,
  };
  const module = await loadClientModule(dom, "src/client/article-enhancements.ts", "ArticleEnhancementsClient");
  module.initArticleEnhancements();
  const headings = dom.window.document.querySelectorAll("h2, h3");
  headings[0].getBoundingClientRect = () => ({ top: -200 });
  headings[1].getBoundingClientRect = () => ({ top: 50 });
  headings[2].getBoundingClientRect = () => ({ top: 500 });
  dom.window.dispatchEvent(new dom.window.Event("scroll"));
  const active = dom.window.document.querySelector(".article-toc a.active");
  assert.equal(active.hash, `#${headings[1].id}`);
  assert.equal(active.getAttribute("aria-current"), "true");
  dom.window.close();
});
