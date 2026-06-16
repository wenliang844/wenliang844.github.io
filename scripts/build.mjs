// CWLBlog 静态站点构建脚本。
//
// 输入：src/posts/*.md（front matter + Markdown 正文）
// 输出：post/<slug>/index.html、post/index.html、sitemap.xml、index.xml
//
// 用法：
//   node scripts/build.mjs            # 输出到项目根（覆盖现有产物）
//   node scripts/build.mjs --out dist # 输出到 dist/（用于对齐验证）

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";

import { SITE, STATIC_PAGES, SEARCH_PAGES } from "../src/config.mjs";
import { renderPostPage, renderPostList } from "../src/templates/post.mjs";
import { renderTagsPage } from "../src/templates/tags.mjs";
import { renderCategoriesPage } from "../src/templates/categories.mjs";
import { renderAiPage } from "../src/templates/ai.mjs";
import { rfc822, sitemapDate } from "../src/lib/format.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const POSTS_DIR = join(ROOT, "src", "posts");

// 输出目录：--out <dir>，默认项目根。
const outIdx = process.argv.indexOf("--out");
const OUT_DIR = outIdx !== -1 ? join(ROOT, process.argv[outIdx + 1]) : ROOT;

marked.setOptions({ gfm: true, breaks: false });

// YAML 会把不带引号的 date 解析为 Date 对象；统一规范成 "YYYY-MM-DD" 字符串。
function normalizeDate(d) {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d);
}

// marked 在内联 HTML 块后会多输出空行；压缩块间空行让产物更干净。
// 先用 \x00（不会出现在正文）包裹占位序号抽出 <pre> 代码块，
// 避免压掉代码内部的空行，压缩后再还原。
function tidyHtml(html) {
  const blocks = [];
  let s = html.replace(/<pre[\s\S]*?<\/pre>/g, (m) => {
    blocks.push(m);
    return "\x00" + (blocks.length - 1) + "\x00";
  });
  s = s.replace(/\n{2,}/g, "\n");
  s = s.replace(/\x00(\d+)\x00/g, (_, i) => blocks[Number(i)]);
  return s.trim();
}

// 把正文 Markdown 渲染为 HTML，并缩进对齐到 article-content 内部（10 空格）。
function renderContent(markdown) {
  const html = tidyHtml(marked.parse(markdown));
  return html
    .split("\n")
    .map((line) => (line ? "          " + line : line))
    .join("\n");
}

// 读取并解析所有文章，按日期倒序（最新在前）。
async function loadPosts() {
  const files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith(".md"));
  const posts = [];

  for (const file of files) {
    const raw = await readFile(join(POSTS_DIR, file), "utf8");
    const { data, content } = matter(raw);
    const slug = data.slug || file.replace(/\.md$/, "");

    posts.push({
      title: data.title,
      titleEn: data.titleEn,
      shortTitle: data.shortTitle,
      shortTitleEn: data.shortTitleEn,
      slug,
      date: normalizeDate(data.date),
      eyebrow: data.eyebrow,
      summary: data.summary,
      summaryEn: data.summaryEn,
      description: data.description,
      descriptionEn: data.descriptionEn,
      tags: data.tags || [],
      tagsEn: data.tagsEn || data.tags || [],
      contentHtml: renderContent(content),
      contentHtmlEn: data.contentEn ? renderContent(data.contentEn) : "",
    });
  }

  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return posts;
}

async function writeFileEnsured(relPath, content) {
  const full = join(OUT_DIR, relPath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, "utf8");
  return full;
}

// 去掉 HTML 标签，保留纯文本，供搜索索引全文检索。
function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function localizedPost(post) {
  return {
    title: post.titleEn || post.title,
    shortTitle: post.shortTitleEn || post.shortTitle,
    summary: post.summaryEn || post.summary,
    tags: post.tagsEn || post.tags,
    body: stripHtml(post.contentHtmlEn || post.contentHtml).slice(0, 600),
  };
}

// 生成搜索索引 JSON（文章 + 静态页），供全局模糊搜索使用。
function buildSearchIndex(posts) {
  return JSON.stringify(
    posts.map((p) => ({
      type: "post",
      title: p.title,
      shortTitle: p.shortTitle,
      summary: p.summary,
      date: p.date,
      tags: p.tags,
      path: `/post/${p.slug}/`,
      slug: p.slug,
      body: stripHtml(p.contentHtml).slice(0, 600),
      i18n: {
        en: localizedPost(p),
      },
    })).concat(SEARCH_PAGES.map((p) => ({ type: "page", ...p }))),
    null,
    0,
  );
}

// sitemap.xml：静态页 + 文章页（插入到 /post/ 之后），对齐现有顺序。
function buildSitemap(posts) {
  const siteLastmod = sitemapDate(posts[0].date);
  const rows = [];

  for (const page of STATIC_PAGES) {
    const loc = `${SITE.baseURL}${page.path}`;
    let row = `  <url><loc>${loc}</loc>`;
    if (page.withDate) row += `<lastmod>${siteLastmod}</lastmod>`;
    if (page.priority !== undefined) row += `<priority>${page.priority}</priority>`;
    row += `</url>`;
    rows.push(row);

    if (page.insertPostsAfter) {
      for (const post of posts) {
        rows.push(
          `  <url><loc>${SITE.baseURL}/post/${post.slug}/</loc><lastmod>${sitemapDate(post.date)}</lastmod></url>`,
        );
      }
    }
  }

  return `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${rows.join("\n")}
</urlset>`;
}

// 统计所有文章的标签及出现次数，按文章数降序、同数按名称升序排列。
function collectTags(posts) {
  const counts = new Map();
  const namesEn = new Map();
  for (const post of posts) {
    for (const [index, tag] of post.tags.entries()) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
      if (!namesEn.has(tag)) {
        namesEn.set(tag, (post.tagsEn && post.tagsEn[index]) || tag);
      }
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, tagEn: namesEn.get(tag) || tag, count }))
    .sort((a, b) =>
      b.count - a.count || a.tag.localeCompare(b.tag, "zh-Hans-CN"),
    );
}

// index.xml：RSS 2.0，对齐现有结构。
function buildRssItems(posts) {
  return posts
    .map((post) => {
      const url = `${SITE.baseURL}/post/${post.slug}/`;
      return `    <item>
      <title>${post.shortTitle}</title>
      <link>${url}</link>
      <pubDate>${rfc822(post.date)}</pubDate>
      <guid>${url}</guid>
      <description>${post.description}</description>
    </item>`;
    })
    .join("\n");
}

function buildStats(posts) {
  const years = [...new Set(posts.map((post) => post.date.slice(0, 4)))];
  const startYear = years[years.length - 1];
  const endYear = years[0];
  return {
    count: posts.length,
    systems: SITE.systems,
    startYear,
    endYear,
    yearCount: years.length,
    range: startYear === endYear ? endYear : `${startYear}-${endYear}`,
  };
}

function buildRss(posts) {
  const lastBuild = rfc822(posts[0].date);
  const items = buildRssItems(posts);

  return `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE.title}</title>
    <link>${SITE.baseURL}/</link>
    <description>Recent content on ${SITE.title}</description>
    <generator>Hugo -- gohugo.io</generator>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${SITE.baseURL}/index.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}

// post/index.xml：博客目录 RSS，保持 /post/ 下的订阅入口同步。
function buildPostRss(posts) {
  const lastBuild = rfc822(posts[0].date);
  const items = buildRssItems(posts);

  return `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Posts on ${SITE.title}</title>
    <link>${SITE.baseURL}/post/</link>
    <description>Recent content in Posts on ${SITE.title}</description>
    <generator>Hugo -- gohugo.io</generator>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${SITE.baseURL}/post/index.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}

// categories/index.xml：时间归档页 RSS，避免分类页订阅入口停留在旧占位内容。
function buildCategoriesRss(posts) {
  const lastBuild = rfc822(posts[0].date);
  const items = buildRssItems(posts);

  return `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Time Archive on ${SITE.title}</title>
    <link>${SITE.baseURL}/categories/</link>
    <description>Project retrospectives by year on ${SITE.title}</description>
    <generator>Hugo -- gohugo.io</generator>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${SITE.baseURL}/categories/index.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}

async function main() {
  const posts = await loadPosts();
  if (posts.length === 0) {
    console.error("没有找到任何文章（src/posts/*.md）。");
    process.exit(1);
  }

  const stats = buildStats(posts);

  // 单篇页
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const nav = { prev: posts[i - 1] || null, next: posts[i + 1] || null };
    await writeFileEnsured(`post/${post.slug}/index.html`, renderPostPage(post, nav) + "\n");
  }

  // 列表页
  await writeFileEnsured("post/index.html", renderPostList(posts, stats) + "\n");

  // 标签云页
  await writeFileEnsured("tags/index.html", renderTagsPage(collectTags(posts)) + "\n");

  // 时间归档页
  await writeFileEnsured("categories/index.html", renderCategoriesPage(posts, stats) + "\n");

  // AI 导航页
  await writeFileEnsured("ai/index.html", renderAiPage() + "\n");

  // sitemap + RSS
  await writeFileEnsured("sitemap.xml", buildSitemap(posts) + "\n");
  await writeFileEnsured("index.xml", buildRss(posts) + "\n");
  await writeFileEnsured("post/index.xml", buildPostRss(posts) + "\n");
  await writeFileEnsured("categories/index.xml", buildCategoriesRss(posts) + "\n");

  // 搜索索引
  await writeFileEnsured("search-index.json", buildSearchIndex(posts) + "\n");

  console.log(`✓ 构建完成：${posts.length} 篇文章 → ${OUT_DIR}`);
  for (const p of posts) console.log(`  - post/${p.slug}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
