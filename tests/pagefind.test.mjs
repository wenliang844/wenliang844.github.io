import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { assertSearchOutputPath, cleanSearchOutput } from "../scripts/build-search.mjs";

const ROOT = join(import.meta.dirname, "..");

test("Pagefind build artifacts and scripts are committed", async () => {
  const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  await access(join(ROOT, "pagefind", "pagefind.js"));
  await access(join(ROOT, "pagefind", "pagefind-entry.json"));

  assert.match(pkg.scripts.build, /build:content.*build:search/);
  assert.equal(pkg.scripts["build:search"], "node scripts/build-search.mjs");
  const buildSearch = await readFile(join(ROOT, "scripts", "build-search.mjs"), "utf8");
  assert.match(buildSearch, /"--force-language", "zh"/);
  assert.match(buildSearch, /"--include-characters", "\+#_\."/);
});

test("Pagefind build cleanup removes only the validated output directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "cwlblog-pagefind-"));
  const output = join(root, "pagefind");
  const neighbor = join(root, "keep.txt");
  try {
    await mkdir(output, { recursive: true });
    await writeFile(join(output, "stale.pf_meta"), "stale", "utf8");
    await writeFile(neighbor, "keep", "utf8");
    await cleanSearchOutput(root, output);
    await assert.rejects(access(output));
    assert.equal(await readFile(neighbor, "utf8"), "keep");
    assert.throws(() => assertSearchOutputPath(root, join(root, "other")), /Refusing to clean/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("generated pages mark the main content as the Pagefind body", async () => {
  const list = await readFile(join(ROOT, "post", "index.html"), "utf8");
  const article = await readFile(join(ROOT, "post", "rule-engine-alerts", "index.html"), "utf8");
  const listDocument = new JSDOM(list).window.document;
  const articleDocument = new JSDOM(article).window.document;

  assert.ok(listDocument.querySelector("main[data-pagefind-body]"));
  assert.ok(articleDocument.querySelector("main[data-pagefind-body]"));
  assert.ok(articleDocument.querySelector('[data-pagefind-meta="title"]'));
  assert.ok(articleDocument.querySelector('[data-pagefind-meta="date[datetime]"]'));
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
