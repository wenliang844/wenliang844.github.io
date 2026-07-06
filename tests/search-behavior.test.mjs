import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

async function loadSearchDom(options = {}) {
  const dom = new JSDOM(`<!doctype html><html lang="zh-CN"><body>
    <nav class="navigation">
      <button class="nav-search-trigger" type="button" aria-label="全局搜索"></button>
    </nav>
  </body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
    pretendToBeVisual: true,
  });

  Object.defineProperty(dom.window.navigator, "onLine", {
    configurable: true,
    value: options.online !== false,
  });

  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  dom.window.fetch = options.fetch || (async () => ({
    ok: true,
    json: async () => [],
  }));
  dom.window.Fuse = class FakeFuse {
    constructor(data) {
      this.data = data;
    }

    search(query) {
      const needle = String(query || "").toLowerCase();
      const keys = ["title", "shortTitle", "sectionTitle", "tags", "summary", "body", "path"];
      return this.data
        .filter((item) => JSON.stringify(item).toLowerCase().includes(needle))
        .map((item) => {
          const matches = [];
          for (const key of keys) {
            const values = Array.isArray(item[key]) ? item[key] : [item[key]];
            for (const value of values) {
              const text = String(value || "");
              const idx = text.toLowerCase().indexOf(needle);
              if (idx !== -1) {
                matches.push({ key, value: text, indices: [[idx, idx + needle.length - 1]] });
              }
            }
          }
          return { item, matches };
        });
    }
  };

  const i18n = await readFile(join(ROOT, "js", "i18n.js"), "utf8");
  const utils = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const search = await readFile(join(ROOT, "js", "search.js"), "utf8");
  dom.window.eval(i18n);
  if (options.lang === "en") {
    dom.window.cwlSetLang("en");
  }
  dom.window.eval(utils);
  dom.window.CWLUtils.debounce = null;
  dom.window.eval(search);
  return dom;
}

async function waitForText(dom, selector, pattern) {
  const started = Date.now();
  while (Date.now() - started < 1000) {
    const text = dom.window.document.querySelector(selector)?.textContent || "";
    if (pattern.test(text)) {
      return text;
    }
    await new Promise((resolve) => dom.window.setTimeout(resolve, 10));
  }
  assert.fail(`Timed out waiting for ${selector} to match ${pattern}`);
}

test("search.js explains uncached search index failures while offline", async () => {
  const dom = await loadSearchDom({
    online: false,
    fetch: async () => {
      throw new TypeError("Failed to fetch");
    },
  });

  dom.window.cwlOpenSearch();
  const text = await waitForText(dom, ".search-modal-empty", /当前离线且搜索索引尚未缓存/);
  assert.match(text, /联网后再试/);
  assert.match(await waitForText(dom, ".search-modal-status", /当前离线，搜索索引尚未加载/), /离线/);
  assert.equal(dom.window.document.querySelector(".search-modal-status").dataset.state, "offline-missing");

  dom.window.close();
});

test("search.js localizes offline search index failure in English", async () => {
  const dom = await loadSearchDom({
    lang: "en",
    online: false,
    fetch: async () => {
      throw new TypeError("Failed to fetch");
    },
  });

  dom.window.cwlOpenSearch();
  const text = await waitForText(dom, ".search-modal-empty", /You are offline/);
  assert.match(text, /not cached yet/);
  assert.match(await waitForText(dom, ".search-modal-status", /Offline; search index is not loaded yet/), /Offline/);

  dom.window.close();
});

test("search.js reports invalid search index data separately", async () => {
  const dom = await loadSearchDom({
    fetch: async () => ({
      ok: true,
      json: async () => ({ posts: [] }),
    }),
  });

  dom.window.cwlOpenSearch();
  const text = await waitForText(dom, ".search-modal-empty", /搜索索引内容异常/);
  assert.match(text, /刷新页面/);
  assert.match(await waitForText(dom, ".search-modal-status", /搜索索引内容异常/), /异常/);
  assert.equal(dom.window.document.querySelector(".search-modal-status").dataset.state, "invalid");

  dom.window.close();
});

test("search.js renders results after the search index loads", async () => {
  const dom = await loadSearchDom({
    fetch: async () => ({
      ok: true,
      json: async () => [
        {
          type: "post",
          title: "Codex Claude Vibe Coding",
          summary: "AI coding workflow notes",
          date: "2024-06-15",
          modified: "2024-06-20",
          path: "/post/codex-claude-vibe-coding/",
          tags: ["AI", "Codex"],
        },
      ],
    }),
  });

  dom.window.cwlOpenSearch();
  await waitForText(dom, ".search-modal-empty", /输入关键词开始搜索/);
  assert.match(await waitForText(dom, ".search-modal-status", /搜索索引已就绪/), /就绪/);
  const input = dom.window.document.querySelector(".search-modal-input");
  input.value = "codex";
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

  const title = await waitForText(dom, ".search-result-title", /Codex Claude/);
  assert.match(title, /Vibe Coding/);
  assert.match(await waitForText(dom, ".search-result-date", /更新 2024\.06\.20/), /2024\.06\.20/);
  assert.equal(dom.window.document.querySelectorAll(".search-modal-results li").length, 1);

  dom.window.close();
});

test("search.js shows offline-ready status after the loaded index remains available", async () => {
  const dom = await loadSearchDom({
    fetch: async () => ({
      ok: true,
      json: async () => [
        {
          type: "post",
          title: "离线搜索缓存",
          summary: "搜索索引已经加载后，断网仍可搜索。",
          path: "/post/offline-search/",
          tags: ["PWA"],
        },
      ],
    }),
  });

  dom.window.cwlOpenSearch();
  await waitForText(dom, ".search-modal-status", /搜索索引已就绪/);
  Object.defineProperty(dom.window.navigator, "onLine", {
    configurable: true,
    value: false,
  });
  dom.window.dispatchEvent(new dom.window.Event("offline"));

  assert.match(await waitForText(dom, ".search-modal-status", /离线可搜索，索引已加载/), /离线可搜索/);
  assert.equal(dom.window.document.querySelector(".search-modal-status").dataset.state, "offline-ready");
  const input = dom.window.document.querySelector(".search-modal-input");
  input.value = "PWA";
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  assert.match(await waitForText(dom, ".search-result-title", /离线搜索缓存/), /离线搜索/);

  dom.window.close();
});

test("search.js explains body-only matches with a matching snippet", async () => {
  const dom = await loadSearchDom({
    fetch: async () => ({
      ok: true,
      json: async () => [
        {
          type: "post",
          title: "企顾 SaaS 多模块平台项目介绍",
          summary: "客户数据资产、财税报表处理、通知触达和搜索检索。",
          body: "搜索模块封装 ESClient、Searcher、Indexer，统一处理连接和异常。",
          path: "/post/finance-saas-backend/",
          tags: ["Elasticsearch"],
        },
      ],
    }),
  });

  dom.window.cwlOpenSearch();
  await waitForText(dom, ".search-modal-empty", /输入关键词开始搜索/);
  const input = dom.window.document.querySelector(".search-modal-input");
  input.value = "ESClient";
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

  const snippet = await waitForText(dom, ".search-result-snippet", /ESClient/);
  assert.match(snippet, /Searcher/);
  assert.match(await waitForText(dom, ".search-result-reason", /命中正文/), /正文/);

  dom.window.close();
});

test("search.js renders article section matches with heading context", async () => {
  const dom = await loadSearchDom({
    fetch: async () => ({
      ok: true,
      json: async () => [
        {
          type: "post-section",
          title: "规则引擎与告警平台",
          sectionTitle: "规则表达式执行链路",
          summary: "规则引擎 / 规则表达式执行链路",
          body: "规则表达式执行链路覆盖 DSL 解析、BPMN 编排和告警触达。",
          path: "/post/rule-engine-alerts/#toc-2-rule-dsl",
          tags: ["规则引擎"],
        },
      ],
    }),
  });

  dom.window.cwlOpenSearch();
  await waitForText(dom, ".search-modal-empty", /输入关键词开始搜索/);
  const input = dom.window.document.querySelector(".search-modal-input");
  input.value = "BPMN";
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

  assert.match(await waitForText(dom, ".search-result-kind", /章节/), /章节/);
  assert.match(await waitForText(dom, ".search-result-section", /规则表达式/), /执行链路/);
  assert.match(await waitForText(dom, ".search-result-meta", /#toc-2-rule-dsl/), /rule-engine-alerts/);
  assert.match(await waitForText(dom, ".search-result-snippet", /BPMN/), /告警触达/);

  dom.window.close();
});

test("search.js renders static page section matches with heading context", async () => {
  const dom = await loadSearchDom({
    fetch: async () => ({
      ok: true,
      json: async () => [
        {
          type: "page-section",
          title: "在线工具箱",
          sectionTitle: "Cron 解析",
          summary: "解析 5 段 Cron 表达式并预测后续执行时间。",
          body: "Cron 解析工具可以解释 5 段表达式。",
          path: "/tools/#tool-tab-cron",
          tags: ["工具", "Cron", "调度"],
        },
      ],
    }),
  });

  dom.window.cwlOpenSearch();
  await waitForText(dom, ".search-modal-empty", /输入关键词开始搜索/);
  const input = dom.window.document.querySelector(".search-modal-input");
  input.value = "Cron";
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

  assert.match(await waitForText(dom, ".search-result-kind", /章节/), /章节/);
  assert.match(await waitForText(dom, ".search-result-title", /在线工具箱/), /工具箱/);
  assert.match(await waitForText(dom, ".search-result-section", /Cron 解析/), /Cron/);
  assert.match(await waitForText(dom, ".search-result-reason", /命中章节/), /章节/);
  assert.match(await waitForText(dom, ".search-result-meta", /#tool-tab-cron/), /\/tools\//);

  dom.window.close();
});

test("search.js localizes article section matches in English", async () => {
  const dom = await loadSearchDom({
    lang: "en",
    fetch: async () => ({
      ok: true,
      json: async () => [
        {
          type: "post-section",
          title: "规则引擎与告警平台",
          sectionTitle: "规则表达式执行链路",
          summary: "规则引擎 / 规则表达式执行链路",
          body: "规则表达式执行链路覆盖 DSL 解析。",
          date: "2024-06-15",
          modified: "2024-06-20",
          path: "/post/rule-engine-alerts/#toc-2-rule-dsl",
          tags: ["规则引擎"],
          i18n: {
            en: {
              title: "Rule Engine Alert Platform",
              sectionTitle: "Expression Execution Pipeline",
              summary: "Rule Engine / Expression Execution Pipeline",
              body: "Expression Execution Pipeline covers DSL parsing and alert delivery.",
              path: "/post/rule-engine-alerts/#toc-2-expression-execution-pipeline",
              tags: ["Rule Engine"],
            },
          },
        },
      ],
    }),
  });

  dom.window.cwlOpenSearch();
  await waitForText(dom, ".search-modal-empty", /Type a keyword/);
  const input = dom.window.document.querySelector(".search-modal-input");
  input.value = "Pipeline";
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

  assert.match(await waitForText(dom, ".search-result-kind", /Section/), /Section/);
  assert.match(await waitForText(dom, ".search-result-section", /Expression Execution Pipeline/), /Pipeline/);
  assert.match(await waitForText(dom, ".search-result-reason", /Matched section/), /section/);
  assert.match(await waitForText(dom, ".search-result-date", /Updated 2024\.06\.20/), /Updated/);
  assert.match(await waitForText(dom, ".search-result-meta", /expression-execution-pipeline/), /rule-engine-alerts/);

  dom.window.close();
});
