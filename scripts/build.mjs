// CWLBlog 静态站点构建脚本。
//
// 输入：src/posts/*.md（front matter + Markdown 正文）
// 输出：post/<slug>/index.html、post/index.html、sitemap.xml、index.xml
//
// 用法：
//   node scripts/build.mjs            # 输出到项目根（覆盖现有产物）
//   node scripts/build.mjs --out dist # 输出到 dist/（用于对齐验证）

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { parse as parseYaml } from "yaml";

import { SITE, STATIC_PAGES, SEARCH_PAGES } from "../src/config.mjs";
import { renderPostPage, renderPostList } from "../src/templates/post.mjs";
import { renderTagsPage } from "../src/templates/tags.mjs";
import { renderCategoriesPage } from "../src/templates/categories.mjs";
import { renderAiPage } from "../src/templates/ai.mjs";
import { renderAppreciationPage } from "../src/templates/appreciation.mjs";
import { renderSponsorPage } from "../src/templates/sponsor.mjs";
import { escapeXml, rfc822, sitemapDate } from "../src/lib/format.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const POSTS_DIR = join(ROOT, "src", "posts");

// 输出目录：--out <dir>，默认项目根。
const outIdx = process.argv.indexOf("--out");
const OUT_DIR = resolveOutDir(outIdx);

marked.setOptions({ gfm: true, breaks: false });

// YAML 会把不带引号的 date 解析为 Date 对象；统一规范成 "YYYY-MM-DD" 字符串。
export function normalizeDate(d) {
  if (d instanceof Date) {
    if (Number.isNaN(d.getTime())) {
      throw new Error("Invalid date value.");
    }
    return d.toISOString().slice(0, 10);
  }
  const dateStr = String(d);
  // 验证日期格式 YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format: "${dateStr}". Expected YYYY-MM-DD.`);
  }
  const [year, month, day] = dateStr.split("-").map((value) => Number.parseInt(value, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date value: "${dateStr}".`);
  }
  return dateStr;
}

// 验证 slug 是否合法（仅包含字母、数字、连字符、下划线）
export function validateSlug(slug, filename) {
  if (!slug || typeof slug !== "string") {
    throw new Error(`Invalid slug in ${filename}: slug is required and must be a string.`);
  }
  if (!/^[a-z0-9_-]+$/i.test(slug)) {
    throw new Error(`Invalid slug in ${filename}: "${slug}". Only letters, numbers, hyphens, and underscores are allowed.`);
  }
  if (slug.length > 100) {
    throw new Error(`Invalid slug in ${filename}: "${slug}" is too long (max 100 characters).`);
  }
}

// 防止多个 Markdown 文件生成到同一个 URL，避免后写文章静默覆盖先写文章。
export function validateUniqueSlug(slug, filename, seenSlugs) {
  const existing = seenSlugs.get(slug);
  if (existing) {
    throw new Error(`Duplicate slug in ${filename}: "${slug}" already used by ${existing}.`);
  }
  seenSlugs.set(slug, filename);
}

// 验证文章必填字段
export function validatePost(data, filename) {
  const required = ["title", "shortTitle", "date", "summary", "description"];
  const missing = required.filter((field) => !data[field]);

  if (missing.length > 0) {
    throw new Error(`Missing required fields in ${filename}: ${missing.join(", ")}`);
  }

  // 验证字段长度
  if (data.title.length > 200) {
    throw new Error(`Title too long in ${filename} (max 200 characters).`);
  }
  if (data.shortTitle.length > 100) {
    throw new Error(`Short title too long in ${filename} (max 100 characters).`);
  }
  if (data.description.length > 500) {
    throw new Error(`Description too long in ${filename} (max 500 characters).`);
  }
}

function resolveOutDir(index) {
  if (index === -1) {
    return ROOT;
  }

  const outArg = process.argv[index + 1];
  if (!outArg || outArg.startsWith("--")) {
    throw new Error("缺少 --out <dir> 参数。");
  }

  const outDir = resolve(ROOT, outArg);
  const rel = relative(ROOT, outDir);
  if (rel && (rel.startsWith("..") || isAbsolute(rel))) {
    throw new Error(`--out 只能指向项目内目录：${outArg}`);
  }
  return outDir;
}

function parseFrontMatter(raw, file) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    throw new Error(`${file}: Missing front matter block.`);
  }
  const data = parseYaml(match[1]) || {};
  const content = raw.slice(match[0].length);
  return { data, content };
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

// 从 HTML 中提取标题生成目录数据
function extractToc(html) {
  const headings = [];
  const regex = /<(h[2-3])>(.*?)<\/\1>/gs;
  let match;
  let h2Index = 0;

  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1][1]); // h2 -> 2, h3 -> 3
    const text = match[2].replace(/<[^>]+>/g, ''); // 移除内联标签
    const id = `toc-${level === 2 ? ++h2Index : h2Index}-${text.replace(/[^\w一-龥]+/g, '-').toLowerCase().slice(0, 50)}`;

    headings.push({ level, text, id });
  }

  return headings;
}

// 把正文 Markdown 渲染为 HTML，为标题添加 id，并缩进对齐到 article-content 内部（10 空格）。
function renderContent(markdown) {
  const html = tidyHtml(marked.parse(markdown));
  const toc = extractToc(html);

  // 为标题添加 id
  let htmlWithIds = html;
  let h2Index = 0;
  htmlWithIds = htmlWithIds.replace(/<(h[2-3])>(.*?)<\/\1>/gs, (match, tag, content) => {
    const level = parseInt(tag[1]);
    const text = content.replace(/<[^>]+>/g, '');
    const id = `toc-${level === 2 ? ++h2Index : h2Index}-${text.replace(/[^\w一-龥]+/g, '-').toLowerCase().slice(0, 50)}`;
    return `<${tag} id="${id}">${content}</${tag}>`;
  });

  const indented = htmlWithIds
    .split("\n")
    .map((line) => (line ? "          " + line : line))
    .join("\n");

  return { html: indented, toc };
}

// 读取并解析所有文章，按日期倒序（最新在前）。
async function loadPosts() {
  const files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith(".md"));
  const posts = [];
  const errors = [];
  const seenSlugs = new Map();

  for (const file of files) {
    try {
      const raw = await readFile(join(POSTS_DIR, file), "utf8");

      // 检查文件是否为空
      if (!raw.trim()) {
        errors.push(`${file}: File is empty`);
        continue;
      }

      const { data, content } = parseFrontMatter(raw, file);

      // 验证必填字段
      validatePost(data, file);

      const slug = data.slug || file.replace(/\.md$/, "");
      validateSlug(slug, file);
      validateUniqueSlug(slug, file, seenSlugs);

      // 检查内容是否为空
      if (!content.trim()) {
        console.warn(`Warning: ${file} has no content body`);
      }

      const contentResult = renderContent(content);
      const contentEnResult = data.contentEn ? renderContent(data.contentEn) : null;

      posts.push({
        title: data.title,
        titleEn: data.titleEn,
        shortTitle: data.shortTitle,
        shortTitleEn: data.shortTitleEn,
        slug,
        date: normalizeDate(data.date),
        eyebrow: data.eyebrow || "项目",
        summary: data.summary,
        summaryEn: data.summaryEn,
        description: data.description,
        descriptionEn: data.descriptionEn,
        tags: Array.isArray(data.tags) ? data.tags : [],
        tagsEn: Array.isArray(data.tagsEn) ? data.tagsEn : (Array.isArray(data.tags) ? data.tags : []),
        contentHtml: contentResult.html,
        contentHtmlEn: contentEnResult ? contentEnResult.html : "",
        toc: contentResult.toc,
        tocEn: contentEnResult ? contentEnResult.toc : [],
        readMinutes: readingMinutes(stripHtml(contentResult.html)),
        images: extractImages(contentResult.html),
      });
    } catch (error) {
      errors.push(`${file}: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    console.error("\n❌ Errors found in the following files:");
    errors.forEach((err) => console.error(`  - ${err}`));
    throw new Error(`Failed to load ${errors.length} post(s). Please fix the errors above.`);
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

// 阅读速度（与 js/coder.js 的 readingMinutes 保持一致）。
const READING_SPEED_CHINESE = 350; // 字/分钟
const READING_SPEED_ENGLISH = 200; // 词/分钟

// 估算正文阅读分钟数（中文按字、其余按词），供 SSR 占位与无 JS 兜底。
export function readingMinutes(text) {
  const chinese = (text.match(/[一-龥]/g) || []).length;
  const rest = text.replace(/[一-龥]/g, " ").trim();
  const words = rest ? rest.split(/\s+/).length : 0;
  return Math.max(
    1,
    Math.round(chinese / READING_SPEED_CHINESE + words / READING_SPEED_ENGLISH),
  );
}

// 把文章内图片 src 解析为绝对 URL：协议开头原样返回，
// 根相对（/ 开头）拼 baseURL，其余按文章目录 /post/<slug>/ 解析。
function absoluteUrl(src, slug) {
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/")) return `${SITE.baseURL}${src}`;
  return `${SITE.baseURL}/post/${slug}/${src.replace(/^\.?\//, "")}`;
}

// 从渲染后的正文 HTML 中提取图片 src（用于 image sitemap）。
function extractImages(html) {
  const urls = [];
  const regex = /<img[^>]*\ssrc="([^"]+)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

// 基于标签重叠为文章挑选相关文章：先按共同标签数降序，
// 同数按日期更新优先；取前 limit 篇。
export function relatedPosts(post, posts, limit = 3) {
  const tags = new Set(post.tags);
  if (tags.size === 0) return [];
  return posts
    .filter((p) => p.slug !== post.slug)
    .map((p) => ({ post: p, shared: p.tags.filter((tag) => tags.has(tag)).length }))
    .filter((entry) => entry.shared > 0)
    .sort((a, b) => b.shared - a.shared || (a.post.date < b.post.date ? 1 : -1))
    .slice(0, limit)
    .map((entry) => entry.post);
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
    const loc = escapeXml(`${SITE.baseURL}${page.path}`);
    let row = `  <url><loc>${loc}</loc>`;
    if (page.withDate) row += `<lastmod>${siteLastmod}</lastmod>`;
    if (page.priority !== undefined) row += `<priority>${page.priority}</priority>`;
    row += `</url>`;
    rows.push(row);

    if (page.insertPostsAfter) {
      for (const post of posts) {
        const loc = escapeXml(`${SITE.baseURL}/post/${post.slug}/`);
        const images = post.images
          .map((src) => `<image:image><image:loc>${escapeXml(absoluteUrl(src, post.slug))}</image:loc></image:image>`)
          .join("");
        rows.push(
          `  <url><loc>${loc}</loc><lastmod>${sitemapDate(post.date)}</lastmod>${images}</url>`,
        );
      }
    }
  }

  return `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
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
      <title>${escapeXml(post.shortTitle)}</title>
      <link>${escapeXml(url)}</link>
      <pubDate>${rfc822(post.date)}</pubDate>
      <guid>${escapeXml(url)}</guid>
      <description>${escapeXml(post.description)}</description>
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
    <title>${escapeXml(SITE.title)}</title>
    <link>${escapeXml(`${SITE.baseURL}/`)}</link>
    <description>${escapeXml(`Recent content on ${SITE.title}`)}</description>
    <generator>Cwl static build</generator>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${escapeXml(`${SITE.baseURL}/index.xml`)}" rel="self" type="application/rss+xml" />
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
    <title>${escapeXml(`Posts on ${SITE.title}`)}</title>
    <link>${escapeXml(`${SITE.baseURL}/post/`)}</link>
    <description>${escapeXml(`Recent content in Posts on ${SITE.title}`)}</description>
    <generator>Cwl static build</generator>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${escapeXml(`${SITE.baseURL}/post/index.xml`)}" rel="self" type="application/rss+xml" />
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
    <title>${escapeXml(`Time Archive on ${SITE.title}`)}</title>
    <link>${escapeXml(`${SITE.baseURL}/categories/`)}</link>
    <description>${escapeXml(`Project retrospectives by year on ${SITE.title}`)}</description>
    <generator>Cwl static build</generator>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${escapeXml(`${SITE.baseURL}/categories/index.xml`)}" rel="self" type="application/rss+xml" />
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
    const nav = {
      prev: posts[i - 1] || null,
      next: posts[i + 1] || null,
      related: relatedPosts(post, posts),
    };
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

  // 鉴赏页
  await writeFileEnsured("appreciation/index.html", renderAppreciationPage() + "\n");

  // 赞助页
  await writeFileEnsured("sponsor/index.html", renderSponsorPage() + "\n");

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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
