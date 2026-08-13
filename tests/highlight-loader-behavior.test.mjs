import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { loadClientModule } from "./helpers/client-module.mjs";

const HIGHLIGHT_SRC = "/js/vendor/highlight.min.js";

function buildDom(hasCodeBlocks = true) {
  const body = hasCodeBlocks
    ? `<article class="article"><div class="article-content">
        <pre><code class="language-javascript">console.log("hello");</code></pre>
        <pre><code class="language-python">print("world")</code></pre>
        <pre><code>plain code</code></pre>
      </div></article>`
    : '<article class="article"><div class="article-content"><p>No code blocks here</p></div></article>';
  return new JSDOM(`<!doctype html><html><head></head><body>${body}</body></html>`, {
    runScripts: "outside-only",
    url: "https://example.com/post/test/",
    pretendToBeVisual: true,
  });
}

function installObserver(dom) {
  let callback = null;
  let observed = null;
  let disconnects = 0;
  dom.window.IntersectionObserver = class {
    constructor(handler) { callback = handler; }
    observe(target) { observed = target; }
    disconnect() { disconnects += 1; }
  };
  return {
    intersect() { callback([{ isIntersecting: true, target: observed }]); },
    get observed() { return observed; },
    get disconnects() { return disconnects; },
  };
}

async function loadModule(dom) {
  return loadClientModule(dom, "src/client/code-highlight.ts", "CodeHighlightClient");
}

async function flush(dom) {
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
}

test("code highlighting does nothing when the article has no code blocks", async () => {
  const dom = buildDom(false);
  const module = await loadModule(dom);
  module.initCodeHighlight();
  assert.equal(dom.window.document.querySelectorAll('script[src*="highlight"]').length, 0);
  dom.window.close();
});

test("code highlighting waits until the first block approaches the viewport", async () => {
  const dom = buildDom();
  const observer = installObserver(dom);
  const module = await loadModule(dom);
  module.initCodeHighlight();

  assert.equal(observer.observed, dom.window.document.querySelector("pre code"));
  assert.equal(dom.window.document.querySelector(`script[src="${HIGHLIGHT_SRC}"]`), null);
  observer.intersect();
  const script = dom.window.document.querySelector(`script[src="${HIGHLIGHT_SRC}"]`);
  assert.ok(script);
  assert.equal(script.async, true);
  assert.equal(observer.disconnects, 1);
  dom.window.close();
});

test("code highlighting configures the API and highlights each block once", async () => {
  const dom = buildDom();
  const observer = installObserver(dom);
  const module = await loadModule(dom);
  module.initCodeHighlight();
  module.initCodeHighlight();
  observer.intersect();

  const scripts = dom.window.document.querySelectorAll(`script[src="${HIGHLIGHT_SRC}"]`);
  assert.equal(scripts.length, 1, "parallel initializers must share one vendor request");
  let options = null;
  const highlighted = [];
  dom.window.hljs = {
    configure(value) { options = value; },
    highlightElement(block) { highlighted.push(block); },
  };
  scripts[0].dispatchEvent(new dom.window.Event("load"));
  await flush(dom);

  assert.equal(options.ignoreUnescapedHTML, true);
  assert.ok(options.languages.includes("javascript"));
  assert.ok(options.languages.includes("java"));
  assert.ok(options.languages.includes("python"));
  assert.equal(highlighted.length, 3);
  assert.ok(highlighted.every((block) => block.dataset.cwlHighlighted === "true"));
  dom.window.close();
});

test("code highlighting reuses an existing in-flight vendor script", async () => {
  const dom = buildDom();
  const existing = dom.window.document.createElement("script");
  existing.src = HIGHLIGHT_SRC;
  dom.window.document.head.appendChild(existing);
  const observer = installObserver(dom);
  const module = await loadModule(dom);
  module.initCodeHighlight();
  observer.intersect();

  assert.equal(dom.window.document.querySelectorAll(`script[src="${HIGHLIGHT_SRC}"]`).length, 1);
  const highlighted = [];
  dom.window.hljs = {
    configure() {},
    highlightElement(block) { highlighted.push(block); },
  };
  existing.dispatchEvent(new dom.window.Event("load"));
  await flush(dom);
  assert.equal(highlighted.length, 3);
  dom.window.close();
});

test("code highlighting uses an existing API without adding a script", async () => {
  const dom = buildDom();
  const highlighted = [];
  dom.window.hljs = {
    configure() {},
    highlightElement(block) { highlighted.push(block); },
  };
  const module = await loadModule(dom);
  module.initCodeHighlight();
  await flush(dom);
  assert.equal(dom.window.document.querySelectorAll('script[src*="highlight"]').length, 0);
  assert.equal(highlighted.length, 3);
  dom.window.close();
});

test("code highlighting falls back to viewport checks without IntersectionObserver", async () => {
  const dom = buildDom();
  const block = dom.window.document.querySelector("pre code");
  block.getBoundingClientRect = () => ({ top: 5000, bottom: 5040 });
  dom.window.CWLUtils = { throttle: (callback) => callback };
  const module = await loadModule(dom);
  module.initCodeHighlight();
  assert.equal(dom.window.document.querySelector(`script[src="${HIGHLIGHT_SRC}"]`), null);

  block.getBoundingClientRect = () => ({ top: 100, bottom: 140 });
  dom.window.dispatchEvent(new dom.window.Event("scroll"));
  assert.ok(dom.window.document.querySelector(`script[src="${HIGHLIGHT_SRC}"]`));
  dom.window.close();
});

test("code highlighting reports block errors and recovers from a failed vendor request", async () => {
  const dom = buildDom();
  const warnings = [];
  dom.window.console.warn = (...items) => warnings.push(items.join(" "));
  let observer = installObserver(dom);
  const module = await loadModule(dom);
  module.initCodeHighlight();
  observer.intersect();
  const failed = dom.window.document.querySelector(`script[src="${HIGHLIGHT_SRC}"]`);
  failed.dispatchEvent(new dom.window.Event("error"));
  await flush(dom);
  assert.ok(warnings.some((message) => message.includes("Failed to load highlight.js")));

  observer = installObserver(dom);
  module.initCodeHighlight();
  observer.intersect();
  const retry = dom.window.document.querySelector(`script[src="${HIGHLIGHT_SRC}"]`);
  assert.notEqual(retry, failed);
  dom.window.hljs = {
    configure() {},
    highlightElement() { throw new Error("highlight failed"); },
  };
  retry.dispatchEvent(new dom.window.Event("load"));
  await flush(dom);
  assert.ok(warnings.some((message) => message.includes("Failed to highlight code block")));
  dom.window.close();
});

test("code highlighting disconnects without loading after pagehide", async () => {
  const dom = buildDom();
  const observer = installObserver(dom);
  const module = await loadModule(dom);
  module.initCodeHighlight();
  dom.window.dispatchEvent(new dom.window.Event("pagehide"));
  observer.intersect();
  assert.equal(observer.disconnects, 1);
  assert.equal(dom.window.document.querySelector(`script[src="${HIGHLIGHT_SRC}"]`), null);
  dom.window.close();
});
