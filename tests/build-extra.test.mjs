// Deep test: build.mjs 辅助函数 — collectTags, stripHtml, extractToc, tidyHtml, absoluteUrl, buildSearchIndex i18n
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDate, validateSlug, validatePost, tidyHtml, renderContent, readingMinutes, relatedPosts } from "../scripts/build.mjs";
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
      assert.ok(p.i18n, `post ${p.slug} should have i18n`);
      assert.ok(p.i18n.en, `post ${p.slug} should have i18n.en`);
      assert.ok(typeof p.i18n.en.title === "string", `post ${p.slug} should have en title`);
      assert.ok(p.i18n.en.title.length > 0, `post ${p.slug} en title should not be empty`);
      assert.ok(Array.isArray(p.i18n.en.tags), `post ${p.slug} should have en tags array`);
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
    assert.match(robots, /Disallow: \/js\/vendor\//);
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
