import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

test("Pagefind build artifacts and scripts are committed", async () => {
  const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  await access(join(ROOT, "pagefind", "pagefind.js"));
  await access(join(ROOT, "pagefind", "pagefind-entry.json"));

  assert.match(pkg.scripts.build, /build:content.*build:search/);
  assert.match(pkg.scripts["build:search"], /pagefind --site/);
  assert.match(pkg.scripts["build:search"], /--force-language zh/);
});

test("generated pages mark the main content as the Pagefind body", async () => {
  const list = await readFile(join(ROOT, "post", "index.html"), "utf8");
  const article = await readFile(join(ROOT, "post", "rule-engine-alerts", "index.html"), "utf8");

  assert.match(list, /<main data-pagefind-body/);
  assert.match(article, /<main data-pagefind-body/);
  assert.match(article, /data-pagefind-meta="title"/);
  assert.match(article, /data-pagefind-meta="date\[datetime\]"/);
});

test("global search prefers Pagefind results with source snippets", async () => {
  const dom = new JSDOM(`<!doctype html><html lang="zh-CN"><body>
    <header class="navigation"><button class="nav-search-trigger" type="button">Search</button></header>
  </body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  const utils = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const search = await readFile(join(ROOT, "js", "search.js"), "utf8");
  let pagefindQueries = 0;

  dom.window.eval(utils);
  dom.window.cwlPagefindImport = async () => ({
    init: async () => {},
    search: async (query) => {
      pagefindQueries += 1;
      return {
        results: [{
          score: 1,
          data: async () => ({
            url: "/post/activiti-workflow-engine/",
            meta: { title: "Activiti 工作流引擎", date: "2025-04-01" },
            excerpt: `用 <mark>${query}</mark> 编排业务审批`,
          }),
        }],
      };
    },
  });
  dom.window.fetch = async () => {
    throw new Error("Fuse fallback should not load");
  };
  dom.window.eval(search);
  dom.window.cwlOpenSearch();
  await new Promise((resolve) => dom.window.setTimeout(resolve, 20));

  const input = dom.window.document.querySelector(".search-modal-input");
  input.value = "工作流";
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 250));

  assert.equal(pagefindQueries, 1);
  assert.match(dom.window.document.querySelector(".search-result-title").textContent, /Activiti/);
  assert.match(dom.window.document.querySelector(".search-result-snippet").textContent, /业务审批/);
  assert.equal(dom.window.document.querySelector(".search-result-meta").firstChild.textContent, "/post/activiti-workflow-engine/");
  dom.window.close();
});
