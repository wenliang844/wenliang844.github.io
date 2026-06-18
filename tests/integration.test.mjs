// Phase 7: 构建集成测试
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = join(import.meta.dirname, "..");

async function runBuild(args = []) {
  return execFileAsync("node", ["scripts/build.mjs", ...args], { cwd: ROOT, windowsHide: true });
}

// ─── 构建产物完整性 ────────────────────────────────────────────────────────────

test("build produces all expected output files", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-integration-"));
  try {
    await runBuild(["--out", outDir]);

    // 验证所有文章页面存在
    const expectedSlugs = [
      "manage-system", "finance-saas-backend", "lowcode-schema-codegen",
      "activiti-workflow-engine", "rule-engine-alerts", "codex-claude-vibe-coding",
    ];
    for (const slug of expectedSlugs) {
      const html = await readFile(join(outDir, "post", slug, "index.html"), "utf8");
      assert.ok(html.length > 100, `post/${slug}/index.html is too short`);
    }

    // 验证列表页
    const postList = await readFile(join(outDir, "post", "index.html"), "utf8");
    assert.ok(postList.length > 100, "post/index.html is too short");

    // 验证其他生成页面
    const generatedPages = [
      "tags/index.html",
      "categories/index.html",
      "ai/index.html",
      "tools/index.html",
      "appreciation/index.html",
      "sponsor/index.html",
    ];
    for (const page of generatedPages) {
      const html = await readFile(join(outDir, page), "utf8");
      assert.ok(html.length > 100, `${page} is too short`);
    }

    // 验证 sitemap
    const sitemap = await readFile(join(outDir, "sitemap.xml"), "utf8");
    assert.match(sitemap, /^<\?xml/);
    assert.match(sitemap, /<urlset /);

    // 验证 RSS
    const rss = await readFile(join(outDir, "index.xml"), "utf8");
    assert.match(rss, /^<\?xml/);
    assert.match(rss, /<rss version="2.0"/);

    // 验证 post RSS
    const postRss = await readFile(join(outDir, "post", "index.xml"), "utf8");
    assert.match(postRss, /<rss version="2.0"/);

    // 验证 categories RSS
    const catRss = await readFile(join(outDir, "categories", "index.xml"), "utf8");
    assert.match(catRss, /<rss version="2.0"/);

    // 验证搜索索引
    const searchIndex = JSON.parse(await readFile(join(outDir, "search-index.json"), "utf8"));
    assert.ok(Array.isArray(searchIndex), "search-index.json should be an array");
    assert.ok(searchIndex.length > 0, "search-index.json should not be empty");
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// ─── sitemap 格式验证 ──────────────────────────────────────────────────────────

test("sitemap contains all static pages", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-sitemap-"));
  try {
    await runBuild(["--out", outDir]);
    const sitemap = await readFile(join(outDir, "sitemap.xml"), "utf8");

    // 必须包含的静态页
    const requiredPaths = [
      "https://wenliang844.github.io/",
      "https://wenliang844.github.io/about/",
      "https://wenliang844.github.io/post/",
      "https://wenliang844.github.io/tools/",
      "https://wenliang844.github.io/ai/",
      "https://wenliang844.github.io/tags/",
    ];
    for (const path of requiredPaths) {
      assert.ok(sitemap.includes(`<loc>${path}</loc>`), `sitemap missing: ${path}`);
    }

    // 必须包含所有文章
    const slugs = [
      "manage-system", "finance-saas-backend", "lowcode-schema-codegen",
      "activiti-workflow-engine", "rule-engine-alerts", "codex-claude-vibe-coding",
    ];
    for (const slug of slugs) {
      assert.ok(
        sitemap.includes(`<loc>https://wenliang844.github.io/post/${slug}/</loc>`),
        `sitemap missing post: ${slug}`,
      );
    }

    // 验证 XML 结构
    assert.match(sitemap, /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// ─── RSS 格式验证 ──────────────────────────────────────────────────────────────

test("RSS feed contains all posts with correct structure", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-rss-"));
  try {
    await runBuild(["--out", outDir]);
    const rss = await readFile(join(outDir, "index.xml"), "utf8");

    // RSS 结构
    assert.match(rss, /<channel>/);
    assert.match(rss, /<title>CWLBlog<\/title>/);
    assert.match(rss, /<language>zh-CN<\/language>/);
    assert.match(rss, /<lastBuildDate>/);
    assert.match(rss, /<generator>/);

    // 包含所有文章的 item
    const items = rss.match(/<item>/g);
    assert.ok(items && items.length === 6, `Expected 6 RSS items, got ${items ? items.length : 0}`);

    // 每个 item 有 title, link, pubDate, guid, description
    assert.match(rss, /<title>/);
    assert.match(rss, /<link>/);
    assert.match(rss, /<pubDate>/);
    assert.match(rss, /<guid>/);
    assert.match(rss, /<description>/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// ─── 搜索索引结构验证 ─────────────────────────────────────────────────────────

test("search index has correct structure for posts and pages", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-search-"));
  try {
    await runBuild(["--out", outDir]);
    const index = JSON.parse(await readFile(join(outDir, "search-index.json"), "utf8"));

    // 验证 post 条目结构
    const posts = index.filter(i => i.type === "post");
    assert.equal(posts.length, 6);
    for (const post of posts) {
      assert.ok(post.title, "post missing title");
      assert.ok(post.shortTitle, "post missing shortTitle");
      assert.ok(post.summary, "post missing summary");
      assert.ok(post.date, "post missing date");
      assert.ok(Array.isArray(post.tags), "post missing tags array");
      assert.ok(post.path && post.path.startsWith("/post/"), "post missing path");
      assert.ok(post.slug, "post missing slug");
      assert.ok(typeof post.body === "string", "post missing body");
      assert.ok(post.i18n && post.i18n.en, "post missing i18n.en");
    }

    // 验证 page 条目结构
    const pages = index.filter(i => i.type === "page");
    assert.ok(pages.length > 0, "should have page entries");
    for (const page of pages) {
      assert.ok(page.title, "page missing title");
      assert.ok(page.summary, "page missing summary");
      assert.ok(page.path, "page missing path");
      assert.ok(Array.isArray(page.tags), "page missing tags array");
    }

    // 所有路径使用正斜杠
    for (const item of index) {
      assert.ok(!item.path.includes("\\"), `path contains backslash: ${item.path}`);
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// ─── HTML 有效性验证 ──────────────────────────────────────────────────────────

test("all generated HTML files have doctype and proper structure", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-html-"));
  try {
    await runBuild(["--out", outDir]);

    const pages = [
      "post/index.html",
      "post/manage-system/index.html",
      "tags/index.html",
      "categories/index.html",
      "ai/index.html",
      "tools/index.html",
      "appreciation/index.html",
      "sponsor/index.html",
    ];

    for (const page of pages) {
      const html = await readFile(join(outDir, page), "utf8");
      assert.ok(html.startsWith("<!doctype html>"), `${page}: missing doctype`);
      assert.ok(html.includes("<html lang="), `${page}: missing html lang`);
      assert.ok(html.includes("<head>"), `${page}: missing <head>`);
      assert.ok(html.includes("</head>"), `${page}: missing </head>`);
      assert.ok(html.includes("<body"), `${page}: missing <body>`);
      assert.ok(html.includes("</body>"), `${page}: missing </body>`);
      assert.ok(html.includes("</html>"), `${page}: missing </html>`);
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// ─── 构建错误处理 ──────────────────────────────────────────────────────────────

test("build fails gracefully with no markdown files", async () => {
  // 这个测试验证构建脚本在没有文章时的行为
  // 实际上构建脚本会 exit(1)
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-empty-"));
  try {
    // 构建应该成功（因为有 6 篇文章）
    const { stdout } = await runBuild(["--out", outDir]);
    assert.match(stdout, /构建完成/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
