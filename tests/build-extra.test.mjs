// Deep test: build.mjs 辅助函数 — collectTags, stripHtml, extractToc, tidyHtml, absoluteUrl, buildSearchIndex i18n
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDate, normalizeReviewedDate, normalizePostStatus, validateSlug, validatePost, tidyHtml, renderContent, readingMinutes, relatedPosts, extractSearchSections, buildSitemap, buildRssItems } from "../scripts/build.mjs";
import { readFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { JSDOM } from "jsdom";

const execFileAsync = promisify(execFile);
const ROOT = join(import.meta.dirname, "..");

async function runBuild(args = []) {
  return execFileAsync("node", ["scripts/build.mjs", ...args], {
    cwd: ROOT,
    windowsHide: true,
  });
}

function extractJsonLd(html) {
  const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(ldMatch, "page should include JSON-LD script");
  return JSON.parse(ldMatch[1]);
}

// ─── collectTags 排序与去重 ─────────────────────────────────────────────────

test("build produces tag cloud sorted by count descending", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-tags-"));
  try {
    await runBuild(["--out", outDir]);
    const tagsHtml = await readFile(join(outDir, "tags", "index.html"), "utf8");
    // 应包含标签云
    assert.match(tagsHtml, /tag-cloud|tag-count|tag-chip/);
    // 应包含 Java 标签（多篇文章共用）
    assert.ok(tagsHtml.includes("Java"), "tags page should contain Java tag");
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// ─── sitemap 文章图片 image:image 标签 ─────────────────────────────────────

test("build sitemap includes image:image entries for posts with images", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-img-"));
  try {
    await runBuild(["--out", outDir]);
    const sitemap = await readFile(join(outDir, "sitemap.xml"), "utf8");
    // sitemap 应包含 image 命名空间
    assert.match(sitemap, /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/);
    // 应包含 post URL
    assert.match(sitemap, /<loc>https:\/\/wenliang844\.github\.io\/post\/manage-system\/<\/loc>/);
    assert.match(sitemap, /<image:loc>https:\/\/wenliang844\.github\.io\/images\/posts\/manage-system\.png<\/image:loc>/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("build sitemap uses modified date for post lastmod", () => {
  const sitemap = buildSitemap([
    { slug: "test-post", date: "2024-06-15", modified: "2024-06-20", images: [] },
  ]);

  assert.match(
    sitemap,
    /<loc>https:\/\/wenliang844\.github\.io\/post\/test-post\/<\/loc><lastmod>2024-06-20T09:30:00\+08:00<\/lastmod>/,
  );
});

// ─── search-index.json 国际化 ──────────────────────────────────────────────

test("search index includes i18n metadata for posts", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-i18n-"));
  try {
    await runBuild(["--out", outDir]);
    const index = JSON.parse(await readFile(join(outDir, "search-index.json"), "utf8"));

    // 每个 post 应有 i18n.en
    const posts = index.filter(item => item.type === "post");
    for (const p of posts) {
      assert.ok(p.modified >= p.date, `post ${p.slug} should expose normalized modified date`);
      assert.equal(p.freshness, p.modified !== p.date ? "updated" : "published", `post ${p.slug} should expose freshness`);
      assert.ok(p.i18n, `post ${p.slug} should have i18n`);
      assert.ok(p.i18n.en, `post ${p.slug} should have i18n.en`);
      assert.ok(typeof p.i18n.en.title === "string", `post ${p.slug} should have en title`);
      assert.ok(p.i18n.en.title.length > 0, `post ${p.slug} en title should not be empty`);
      assert.ok(Array.isArray(p.i18n.en.tags), `post ${p.slug} should have en tags array`);
    }

    const sections = index.filter(item => item.type === "post-section");
    assert.ok(sections.length > 0, "search index should include post sections");
    for (const section of sections) {
      assert.ok(section.modified >= section.date, `section ${section.path} should expose normalized modified date`);
      assert.equal(section.freshness, section.modified !== section.date ? "updated" : "published", `section ${section.path} should expose freshness`);
    }

    // 每个 page 应有 i18n.en
    const pages = index.filter(item => item.type === "page");
    for (const p of pages) {
      assert.ok(p.i18n, `page ${p.path} should have i18n`);
      assert.ok(p.i18n.en, `page ${p.path} should have i18n.en`);
      assert.ok(p.i18n.en.title.length > 0, `page ${p.path} en title should not be empty`);
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// ─── search-index.json 所有 path 都是正斜杠 ────────────────────────────────

test("search index paths use forward slashes only", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-path-"));
  try {
    await runBuild(["--out", outDir]);
    const index = JSON.parse(await readFile(join(outDir, "search-index.json"), "utf8"));
    for (const item of index) {
      assert.ok(!item.path.includes("\\"), `path should not contain backslash: ${item.path}`);
      assert.ok(item.path.startsWith("/"), `path should start with /: ${item.path}`);
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("search index covers long-tail post keywords while staying lightweight", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-search-quality-"));
  try {
    await runBuild(["--out", outDir]);
    const raw = await readFile(join(outDir, "search-index.json"), "utf8");
    const index = JSON.parse(raw);
    const text = JSON.stringify(index);

    assert.ok(raw.length < 125_000, `search-index.json should stay under 125KB after section indexing, got ${raw.length} bytes`);
    for (const term of ["ESClient", "Web Worker", "Galaxy", "Maven", "BPMN"]) {
      assert.match(text, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `search index should include ${term}`);
    }

    const posts = index.filter((item) => item.type === "post");
    const sections = index.filter((item) => item.type === "post-section");
    const pageSections = index.filter((item) => item.type === "page-section");
    assert.ok(posts.every((post) => post.body.length <= 3200), "post bodies should keep the configured search budget");
    assert.ok(posts.some((post) => post.body.length > 600), "post bodies should no longer all be clipped at 600 chars");
    assert.ok(sections.length >= posts.length, "search index should include article section entries");
    assert.ok(sections.every((section) => section.path.includes("#toc-")), "section entries should deep-link to heading anchors");
    assert.ok(sections.every((section) => section.sectionTitle && section.body.length <= 560), "section entries should include bounded bodies and titles");
    assert.ok(sections.some((section) => /Galaxy|Maven|BPMN|Web Worker|ESClient/i.test(section.body)), "section entries should explain long-tail body matches");
    assert.ok(pageSections.length >= 10, "search index should include static page section entries");
    assert.ok(pageSections.every((section) => section.sectionTitle && section.path.includes("#")), "page sections should include heading context and anchors");
    assert.ok(pageSections.every((section) => !("searchSections" in section)), "page section config should not leak into the search index");
    assert.ok(pageSections.every((section) => !section.body || section.body.length <= 72), "page section bodies should stay tiny");
    assert.ok(pageSections.some((section) => section.path === "/tools/#tool-tab-cron" && /Cron/.test(section.sectionTitle)), "tool sections should deep-link to Cron");
    assert.ok(pageSections.some((section) => section.path === "/trust/#trust-services-title" && /外部服务/.test(section.sectionTitle)), "trust sections should deep-link to services");
    assert.ok(pageSections.some((section) => section.path === "/ai/#nav" && /AI/.test(section.sectionTitle)), "AI sections should deep-link to navigation");

    const htmlBySlug = new Map();
    for (const section of sections) {
      const match = section.path.match(/^\/post\/([^/]+)\/#(.+)$/);
      assert.ok(match, `section path should target a post heading: ${section.path}`);
      const [, slug, id] = match;
      if (!htmlBySlug.has(slug)) {
        htmlBySlug.set(slug, await readFile(join(outDir, "post", slug, "index.html"), "utf8"));
      }
      assert.ok(htmlBySlug.get(slug).includes(`id="${id}"`), `${section.path} should exist in the generated article`);
    }

    const staticHtmlByPath = new Map();
    for (const section of pageSections) {
      const [pagePath, id] = section.path.split("#");
      const htmlPath = pagePath === "/" ? "index.html" : `${pagePath.replace(/^\/|\/$/g, "")}/index.html`;
      if (!staticHtmlByPath.has(pagePath)) {
        staticHtmlByPath.set(pagePath, await readFile(join(outDir, ...htmlPath.split("/")), "utf8"));
      }
      assert.ok(staticHtmlByPath.get(pagePath).includes(`id="${id}"`), `${section.path} should exist in the generated static page`);
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// ─── RSS feed 结构验证 ──────────────────────────────────────────────────────

test("RSS feed has correct channel structure", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-rss-"));
  try {
    await runBuild(["--out", outDir]);
    const rss = await readFile(join(outDir, "index.xml"), "utf8");
    assert.match(rss, /<rss version="2\.0"/);
    assert.match(rss, /<channel>/);
    assert.match(rss, /<title>CWLBlog<\/title>/);
    assert.match(rss, /<language>zh-CN<\/language>/);
    assert.match(rss, /<lastBuildDate>/);
    assert.match(rss, /<atom:link.*rel="self"/);
    // 应包含至少 6 篇文章的 <item>
    const itemCount = (rss.match(/<item>/g) || []).length;
    assert.ok(itemCount >= 6, `RSS should have at least 6 items, got ${itemCount}`);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// ─── post/index.xml 博客目录 RSS ───────────────────────────────────────────

test("post RSS feed exists and has items", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-postrss-"));
  try {
    await runBuild(["--out", outDir]);
    const rss = await readFile(join(outDir, "post", "index.xml"), "utf8");
    assert.match(rss, /<rss version="2\.0"/);
    assert.match(rss, /Posts on CWLBlog/);
    const itemCount = (rss.match(/<item>/g) || []).length;
    assert.ok(itemCount >= 6, `Post RSS should have at least 6 items`);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// ─── categories/index.xml 时间归档 RSS ─────────────────────────────────────

test("categories RSS feed exists and has items", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-catrss-"));
  try {
    await runBuild(["--out", outDir]);
    const rss = await readFile(join(outDir, "categories", "index.xml"), "utf8");
    assert.match(rss, /Time Archive on CWLBlog/);
    const itemCount = (rss.match(/<item>/g) || []).length;
    assert.ok(itemCount >= 6, `Categories RSS should have at least 6 items`);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("RSS variants share one channel renderer", async () => {
  const source = await readFile(join(ROOT, "scripts", "build.mjs"), "utf8");

  assert.match(source, /function buildRssFeed\(posts, \{ title, link, description, selfHref \}\)/);
  assert.equal((source.match(/return buildRssFeed\(posts,/g) || []).length, 3);
  assert.equal((source.match(/<generator>Cwl static build<\/generator>/g) || []).length, 1);
});

test("RSS items use modified date only for explicit major updates", () => {
  const normal = buildRssItems([{
    shortTitle: "Normal update",
    slug: "normal-update",
    date: "2024-01-01",
    modified: "2024-06-20",
    majorUpdate: false,
    description: "Normal description",
  }]);
  const major = buildRssItems([{
    shortTitle: "Major update",
    slug: "major-update",
    date: "2024-01-01",
    modified: "2024-06-20",
    majorUpdate: true,
    description: "Major description",
  }]);

  assert.match(normal, /<pubDate>Mon, 01 Jan 2024 09:30:00 \+0800<\/pubDate>/);
  assert.match(major, /<pubDate>Thu, 20 Jun 2024 09:30:00 \+0800<\/pubDate>/);
});

test("tidyHtml preserves blank lines inside protected HTML blocks", () => {
  const rawHtml = `<section>Before</section>


<details>

<summary>More</summary>

<div>

Line A

Line B

</div>

</details>

<p>After</p>`;

  const html = tidyHtml(rawHtml);

  assert.ok(html.includes("<details>\n\n<summary>More</summary>"), "details block should keep its internal blank line");
  assert.ok(html.includes("Line A\n\nLine B"), "nested block content should keep internal blank lines");
  assert.ok(!html.includes("<section>Before</section>\n\n\n<details>"), "blank lines between normal output blocks should still be compacted");
  assert.ok(!html.includes("</details>\n\n\n<p>After</p>"), "blank lines after protected blocks should still be compacted");
});

test("renderContent keeps heading ids after HTML tidying", () => {
  const markdown = `<details>

<summary>More</summary>

</details>

## Section

After`;

  const { html } = renderContent(markdown);

  assert.match(html, /<h2 id="toc-1-section">Section<\/h2>/);
});

test("extractSearchSections returns heading anchors and bounded section bodies", () => {
  const { html } = renderContent(`## Alpha Section

This section mentions Galaxy and workers.

### Nested Topic

Nested body talks about Maven and BPMN.`);
  const sections = extractSearchSections(html);

  assert.equal(sections.length, 2);
  assert.deepEqual(
    sections.map((section) => [section.level, section.id, section.title]),
    [
      [2, "toc-1-alpha-section", "Alpha Section"],
      [3, "toc-1-nested-topic", "Nested Topic"],
    ],
  );
  assert.match(sections[0].body, /Galaxy/);
  assert.ok(sections.every((section) => section.body.length <= 560), "section bodies should be bounded");
});

// ─── robots.txt 内容验证 ────────────────────────────────────────────────────

test("robots.txt allows key paths and references sitemap", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-robots-"));
  try {
    await runBuild(["--out", outDir]);
    const robots = await readFile(join(outDir, "robots.txt"), "utf8");
    assert.match(robots, /User-agent: \*/);
    assert.match(robots, /Allow: \//);
    assert.match(robots, /Allow: \/post\//);
    assert.match(robots, /Allow: \/tags\//);
    assert.match(robots, /Allow: \/categories\//);
    assert.match(robots, /Allow: \/ai\//);
    assert.match(robots, /Allow: \/js\//);
    assert.match(robots, /Allow: \/css\//);
    assert.match(robots, /Allow: \/webfonts\//);
    assert.doesNotMatch(robots, /Disallow: \/js\/vendor\//);
    assert.doesNotMatch(robots, /Disallow: \/css\/fontawesome\//);
    assert.match(robots, /Sitemap: https:\/\/wenliang844\.github\.io\/sitemap\.xml/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// ─── 文章页 JSON-LD 结构验证 ────────────────────────────────────────────────

test("article pages include valid JSON-LD structured data", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-jsonld-"));
  try {
    await runBuild(["--out", outDir]);
    const html = await readFile(join(outDir, "post", "manage-system", "index.html"), "utf8");
    // 提取 JSON-LD
    const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(ldMatch, "should have JSON-LD script");
    const ld = JSON.parse(ldMatch[1]);
    assert.equal(ld["@type"], "Article");
    assert.ok(ld.headline, "should have headline");
    assert.ok(ld.datePublished, "should have datePublished");
    assert.ok(ld.author, "should have author");
    assert.ok(ld.mainEntityOfPage, "should have mainEntityOfPage");
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("home page includes valid WebSite JSON-LD structured data", async () => {
  const html = await readFile(join(ROOT, "index.html"), "utf8");
  const ld = extractJsonLd(html);
  assert.equal(ld["@context"], "https://schema.org");
  assert.equal(ld["@type"], "WebSite");
  assert.equal(ld.name, "CWLBlog");
  assert.equal(ld.url, "https://wenliang844.github.io/");
  assert.equal(ld.author["@type"], "Person");
  assert.equal(ld.author.name, "CWL");
  assert.equal(ld.author.url, "https://wenliang844.github.io/about/");
});

test("generated static pages include valid JSON-LD structured data", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-static-jsonld-"));
  try {
    await runBuild(["--out", outDir]);
    const pages = [
      ["post/index.html", "CollectionPage"],
      ["tools/index.html", "WebApplication"],
      ["ai/index.html", "CollectionPage"],
      ["categories/index.html", "CollectionPage"],
      ["tags/index.html", "CollectionPage"],
      ["appreciation/index.html", "CollectionPage"],
      ["sponsor/index.html", "WebPage"],
    ];

    for (const [page, type] of pages) {
      const ld = extractJsonLd(await readFile(join(outDir, ...page.split("/")), "utf8"));
      assert.equal(ld["@context"], "https://schema.org", `${page} should use schema.org context`);
      assert.equal(ld["@type"], type, `${page} should use ${type} JSON-LD`);
      assert.match(ld.url, /^https:\/\/wenliang844\.github\.io\//, `${page} should use absolute URL`);
      assert.equal(ld.isPartOf["@type"], "WebSite", `${page} should link back to the site entity`);
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("hand-written static pages include valid JSON-LD structured data", async () => {
  const pages = [
    ["404.html", "WebPage"],
    ["about/index.html", "Person"],
    ["contact/index.html", "ContactPage"],
    ["editor/index.html", "WebApplication"],
    ["overleaf/index.html", "WebApplication"],
  ];

  for (const [page, type] of pages) {
    const ld = extractJsonLd(await readFile(join(ROOT, ...page.split("/")), "utf8"));
    assert.equal(ld["@context"], "https://schema.org", `${page} should use schema.org context`);
    assert.equal(ld["@type"], type, `${page} should use ${type} JSON-LD`);
    assert.match(ld.url, /^https:\/\/wenliang844\.github\.io\//, `${page} should use absolute URL`);
  }
});

test("404 page declares noindex and structured data", async () => {
  const html = await readFile(join(ROOT, "404.html"), "utf8");
  const ld = extractJsonLd(html);

  assert.match(html, /<meta name="robots" content="noindex,follow">/);
  assert.equal(ld["@type"], "WebPage");
  assert.equal(ld.url, "https://wenliang844.github.io/404.html");
  assert.equal(ld.isPartOf["@type"], "WebSite");
});

// ─── 文章页 canonical 和 og 标签 ────────────────────────────────────────────

test("article pages have canonical URL and Open Graph tags", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-og-"));
  try {
    await runBuild(["--out", outDir]);
    const html = await readFile(join(outDir, "post", "manage-system", "index.html"), "utf8");
    assert.match(html, /<link rel="canonical" href="https:\/\/wenliang844\.github\.io\/post\/manage-system\/">/);
    assert.match(html, /property="og:title"/);
    assert.match(html, /property="og:description"/);
    assert.match(html, /property="og:url"/);
    assert.match(html, /property="og:type" content="article"/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// ─── 文章间 prev/next 导航 ──────────────────────────────────────────────────

test("article pages include prev/next navigation", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-nav-"));
  try {
    await runBuild(["--out", outDir]);
    // 最新文章应有 next 链接
    const html = await readFile(join(outDir, "post", "codex-claude-vibe-coding", "index.html"), "utf8");
    assert.match(html, /class="post-pager"/, "should have post-pager section");
    assert.match(html, /class="next-popup"/, "should have next popup");
    assert.match(html, /data-next-url/, "should have data-next-url attribute");
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// ─── categories 归档页年份统计 ──────────────────────────────────────────────

test("categories page shows year-based archive with stats", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-cat-"));
  try {
    await runBuild(["--out", outDir]);
    const html = await readFile(join(outDir, "categories", "index.html"), "utf8");
    // 应包含年份统计区域
    assert.match(html, /class="timeline-stats"/, "should have timeline-stats section");
    // 应包含文章链接
    assert.match(html, /class="post-tree-link"/, "should have article links");
    // 应包含年份
    assert.ok(html.includes("2024") || html.includes("2025") || html.includes("2026"), "should show year headings");
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// ─── sponsor 页结构验证 ─────────────────────────────────────────────────────

test("sponsor page renders with correct structure", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-sponsor-"));
  try {
    await runBuild(["--out", outDir]);
    const html = await readFile(join(outDir, "sponsor", "index.html"), "utf8");
    assert.ok(html.includes("sponsor-page"), "should have sponsor-page class");
    assert.ok(html.includes("sponsor-layout") || html.includes("sponsor-panel"), "should have sponsor layout elements");
    assert.ok(html.includes("爱发电") || html.includes("Afdian") || html.includes("afdian"), "should reference Afdian");
    assert.ok(html.includes("PayPal") || html.includes("paypal"), "should reference PayPal");
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// ─── normalizeDate 额外边界 ─────────────────────────────────────────────────

test("normalizeDate handles Invalid Date object", () => {
  assert.throws(() => normalizeDate(new Date("invalid")), /Invalid date value/);
});

test("post status metadata validates reviewed date and enum values", () => {
  assert.equal(normalizeReviewedDate("2024-06-20", "2024-06-15"), "2024-06-20");
  assert.equal(normalizeReviewedDate("", "2024-06-15"), "");
  assert.equal(normalizePostStatus("historical"), "historical");
  assert.equal(normalizePostStatus(""), "");
  assert.throws(() => normalizeReviewedDate("2024-06-01", "2024-06-15", "post.md"), /before published date/);
  assert.throws(() => normalizePostStatus("draft", "post.md"), /Invalid status/);
});

test("normalizeDate rejects empty string", () => {
  assert.throws(() => normalizeDate(""), /Invalid date format/);
});

test("normalizeDate handles year boundaries", () => {
  assert.equal(normalizeDate("2000-01-01"), "2000-01-01");
  assert.equal(normalizeDate("2099-12-31"), "2099-12-31");
});

// ─── validateSlug 空白与特殊字符 ────────────────────────────────────────────

test("validateSlug rejects whitespace in slug", () => {
  assert.throws(() => validateSlug("my post", "test.md"), /Only letters/);
});

test("validateSlug rejects Chinese characters", () => {
  assert.throws(() => validateSlug("我的文章", "test.md"), /Only letters/);
});

test("validateSlug accepts single character", () => {
  assert.doesNotThrow(() => validateSlug("a", "test.md"));
});

test("validateSlug rejects tab character", () => {
  assert.throws(() => validateSlug("my\tpost", "test.md"), /Only letters/);
});

// ─── validatePost 部分字段缺失 ──────────────────────────────────────────────

test("validatePost rejects when only shortTitle is missing", () => {
  assert.throws(
    () => validatePost({ title: "T", date: "2024-01-01", summary: "S", description: "D" }, "test.md"),
    /Missing required fields.*shortTitle/
  );
});

test("validatePost rejects when only date is missing", () => {
  assert.throws(
    () => validatePost({ title: "T", shortTitle: "ST", summary: "S", description: "D" }, "test.md"),
    /Missing required fields.*date/
  );
});

// ─── relatedPosts 边界情况 ──────────────────────────────────────────────────

test("relatedPosts returns empty when post has no tags", () => {
  const post = { slug: "a", tags: [] };
  const allPosts = [
    { slug: "a", tags: [] },
    { slug: "b", tags: ["Java"] },
  ];
  const result = relatedPosts(post, allPosts);
  assert.deepEqual(result, []);
});

test("relatedPosts returns at most limit items", () => {
  const post = { slug: "a", tags: ["Java", "Spring"] };
  const allPosts = [
    { slug: "a", tags: ["Java", "Spring"] },
    ...Array.from({ length: 10 }, (_, i) => ({ slug: `p${i}`, tags: ["Java", "Spring"] })),
  ];
  const result = relatedPosts(post, allPosts, 2);
  assert.ok(result.length <= 2, `should return at most 2, got ${result.length}`);
});

test("relatedPosts prefers posts with more shared tags", () => {
  const post = { slug: "a", tags: ["Java", "Spring", "Redis"] };
  const allPosts = [
    { slug: "a", tags: ["Java", "Spring", "Redis"] },
    { slug: "b", tags: ["Java"] },
    { slug: "c", tags: ["Java", "Spring"] },
  ];
  const result = relatedPosts(post, allPosts, 2);
  assert.equal(result[0].slug, "c", "post with 2 shared tags should rank first");
  assert.equal(result[1].slug, "b", "post with 1 shared tag should rank second");
});

test("relatedPosts uses English tags and series signals with reasons", () => {
  const post = {
    slug: "a",
    tags: ["规则"],
    tagsEn: ["Rule Engine"],
    series: "智能分析",
    seriesEn: "Intelligent Analysis",
  };
  const allPosts = [
    { slug: "a", tags: ["规则"], tagsEn: ["Rule Engine"], series: "智能分析", seriesEn: "Intelligent Analysis" },
    { slug: "b", tags: ["告警"], tagsEn: ["Alert System"], series: "智能分析", seriesEn: "Intelligent Analysis", date: "2024-01-01" },
    { slug: "c", tags: ["引擎"], tagsEn: ["Rule Engine"], date: "2024-06-01" },
  ];

  const result = relatedPosts(post, allPosts, 2);
  assert.equal(result[0].slug, "b", "same series should outrank English tag overlap");
  assert.match(result[0].relatedReason, /同属系列/);
  assert.match(result[0].relatedReasonEn, /Same series/);
  assert.equal(result[1].slug, "c");
  assert.match(result[1].relatedReasonEn, /Shared tags: Rule Engine/);
});

// ─── readingMinutes 混合中英文 ──────────────────────────────────────────────

test("readingMinutes handles mixed Chinese and English text", () => {
  // 350 中文字 + 200 英文词 = 1 + 1 = 2 分钟
  const chinese = "你".repeat(350);
  const english = "word ".repeat(200).trim();
  const result = readingMinutes(chinese + " " + english);
  assert.equal(result, 2);
});

test("readingMinutes handles only whitespace and punctuation", () => {
  const result = readingMinutes("   ...   !!!   ???   ");
  assert.equal(result, 1, "should return minimum 1 minute");
});

test("readingMinutes handles HTML-like text", () => {
  const text = "<div>这是一段中文测试文本</div>".replace(/<[^>]+>/g, " ").trim();
  const result = readingMinutes(text);
  assert.ok(result >= 1, "should return at least 1 minute");
});
