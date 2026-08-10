import test from "node:test";
import assert from "node:assert/strict";

import { collectInternalLinks, renderContent, resolvePostLinks } from "../scripts/build.mjs";
import { renderPostPage } from "../src/templates/post.mjs";

function post(slug, overrides = {}) {
  return {
    slug,
    sourceFile: `${slug}.md`,
    title: `${slug} title`,
    shortTitle: slug,
    summary: `${slug} summary`,
    description: `${slug} description`,
    date: "2026-01-01",
    modified: "2026-01-02",
    category: "ai-coding",
    series: "",
    seriesOrder: null,
    eyebrow: "项目",
    tags: ["AI"],
    tagsEn: ["AI"],
    contentHtml: "          <p>Body</p>",
    contentHtmlEn: "",
    toc: [],
    tocEn: [],
    readMinutes: 1,
    images: [],
    outgoingLinks: [],
    ...overrides,
  };
}

test("WikiLinks render as safe post links and preserve labels", () => {
  const rendered = renderContent("阅读 [[target-post|目标 <文章>]]。");
  assert.match(rendered.html, /class="wiki-link" href="\/post\/target-post\/"/);
  assert.match(rendered.html, /目标 &lt;文章&gt;/);
});

test("internal link collection uses Markdown tokens and ignores code", () => {
  const markdown = [
    "[[alpha|Alpha]]",
    "[Beta](/post/beta/)",
    "[External](https://example.com/post/external/)",
    "`[[inline-code]]`",
    "```text",
    "[[fenced-code]]",
    "```",
  ].join("\n\n");
  assert.deepEqual(collectInternalLinks(markdown).sort(), ["alpha", "beta"]);
});

test("link resolution assigns backlinks and rejects missing targets", () => {
  const alpha = post("alpha", { outgoingLinks: ["beta"] });
  const beta = post("beta", { modified: "2026-03-01" });
  resolvePostLinks([alpha, beta]);
  assert.deepEqual(alpha.backlinks, []);
  assert.deepEqual(beta.backlinks.map((item) => item.slug), ["alpha"]);
  assert.throws(
    () => resolvePostLinks([post("broken", { outgoingLinks: ["missing"] })]),
    /internal link target does not exist: missing/,
  );
});

test("article page renders source summaries in its backlink section", () => {
  const source = post("source", { summary: "Source explains this design." });
  const target = post("target");
  const html = renderPostPage(target, {
    prev: null,
    next: null,
    related: [],
    backlinks: [source],
    series: null,
  });
  assert.match(html, /id="post-backlinks-title">哪些文章提到了这里/);
  assert.match(html, /href="\/post\/source\/"/);
  assert.match(html, /Source explains this design\./);
});
